import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Deliberately fixed to the isolated POC API. Never accept an original-system URL.
const base = 'http://127.0.0.1:8098';
const evidence = [];
async function request(path, token, method = 'GET', body, expected = 200) {
  const response = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  assert.ok(text, `${method} ${path}: HTTP ${response.status} empty response`);
  const value = JSON.parse(text);
  assert.equal(response.status, expected, `${method} ${path}: ${value.message}`);
  evidence.push({ method, path, status: response.status });
  return value.data;
}
const login = async (account) => (await request('/api/v1/auth/login', null, 'POST', {
  account, password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-ludong-poc',
})).accessToken;
const admin = await login('LDU000001');
const applicant = await login('LDU100001');
const reviewer = await login('LDU200001');
const receiver = await login('LDU200002');
const applications = await request('/api/v1/buyer/ludong-poc/applications', admin);
const incomplete = applications.find((item) => item.id.startsWith('ldu-poc-demo-') && item.status === 'draft');
if (incomplete) {
  await request(`/api/v1/buyer/ludong-poc/applications/${incomplete.id}/submit`, applicant, 'POST', undefined, 400);
  assert.equal((await request(`/api/v1/buyer/ludong-poc/applications/${incomplete.id}`, admin)).status, 'draft');
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(readFileSync(resolve(root, 'scripts/fixtures/ludong-tender-application.json'), 'utf8'));
const draft = await request('/api/v1/buyer/ludong-poc/applications', applicant, 'POST', fixture);
assert.equal(draft.budgetAmount, 170000, 'Budget must be calculated from the actual equipment list');
await request(`/api/v1/buyer/ludong-poc/applications/${draft.id}/submit`, applicant, 'POST');
const pending = await request('/api/v1/buyer/workflow/tasks', reviewer);
const task = pending.find((item) => item.businessId === draft.id);
assert.ok(task, 'Published Flowable process did not produce the first reviewer task');
const path = `/api/v1/buyer/workflow/tasks/${task.taskId}`;
const recipients = await request(path + '/recipients', reviewer);
assert.ok(recipients.some((user) => user.id === 'user-ldu-it-review'));
const dueAt = new Date(Date.now() + 86400000).toISOString();
await request(path + '/operations', reviewer, 'POST', { action: 'deadline', reason: 'POC真实时限验收', dueAt });
const timing = await request(path + '/timing', reviewer);
assert.equal(new Date(timing.dueAt).getTime(), new Date(dueAt).getTime());
await request(path + '/operations', reviewer, 'POST', { action: 'copy', recipientIds: ['user-ldu-unit-manager'], reason: 'POC抄送验收1' });
await request(path + '/operations', reviewer, 'POST', { action: 'copy', recipientIds: ['user-ldu-unit-manager'], reason: 'POC抄送验收2' });
await request(path + '/operations', reviewer, 'POST', { action: 'transfer', recipientIds: ['user-ldu-it-review'], reason: 'POC转审权限验收' });
await request(path + '/operations', reviewer, 'POST', { action: 'deadline', reason: '过期权限不得继续操作', dueAt }, 403);
await request(`/api/v1/buyer/ludong-poc/tasks/${task.taskId}/complete`, reviewer, 'POST', {
  applicationId: draft.id, nodeId: task.taskDefinitionKey, action: 'approve', comment: '不得使用旧权限审批',
  reviewData: { argumentationOpinion: '同意', argumentationComment: '仅验证旧权限被拒绝' },
}, 403);
const received = await request('/api/v1/buyer/workflow/tasks', receiver);
assert.ok(received.some((item) => item.taskId === task.taskId));
await request(`/api/v1/buyer/workflow/instances/${task.workflowInstanceId}/remind`, applicant, 'POST', { reason: 'POC发起人催办真实当前办理人' });
const history = await request(`/api/v1/buyer/workflow/instances/${task.workflowInstanceId}/history`, admin);
assert.equal(history.events.filter((event) => event.action === 'copied').length, 2);
assert.equal(history.events.filter((event) => event.action === 'transferred').length, 1);
assert.equal(history.events.filter((event) => event.action === 'deadline_changed').length, 1);
assert.equal(history.events.filter((event) => event.action === 'reminded').length, 1);
assert.equal(history.status, 'processing');
const current = await request(`/api/v1/buyer/ludong-poc/applications/${draft.id}`, admin);
assert.equal(current.status, 'in_approval', 'Collaboration must not accidentally complete business approval');
await request(`/api/v1/buyer/ludong-poc/tasks/${task.taskId}/complete`, receiver, 'POST', {
  applicationId: draft.id, nodeId: task.taskDefinitionKey, action: 'approve', comment: '已核验申报资料及采购必要性。',
  reviewData: { argumentationOpinion: '同意', argumentationComment: '拟更新设备与教学用途一致，按提交清单开展后续审核。' },
});
const projected = await request(`/api/v1/buyer/ludong-poc/applications/${draft.id}`, admin);
assert.equal(projected.formData.argumentationOpinion, '同意');
assert.equal(projected.formData.argumentationComment, '拟更新设备与教学用途一致，按提交清单开展后续审核。');
const advanced = await request(`/api/v1/buyer/workflow/instances/${task.workflowInstanceId}/history`, admin);
assert.notEqual(advanced.currentTask?.taskId, task.taskId, 'Flowable must advance to the real next node');
assert.equal(advanced.status, 'processing');
mkdirSync(resolve(root, '.ludong-tender-runtime'), { recursive: true });
writeFileSync(resolve(root, '.ludong-tender-runtime/workflow-smoke.json'), JSON.stringify({
  checkedAt: new Date().toISOString(), applicationId: draft.id, workflowInstanceId: task.workflowInstanceId,
  taskId: task.taskId, checks: evidence, result: 'PASS',
}, null, 2));
console.log(`PASS: ${evidence.length} HTTP requests; validated submission, Flowable transfer/copy/deadline/reminder, stale authority rejection and real node approval projection.`);
