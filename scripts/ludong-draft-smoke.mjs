import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Writes only a new, explicitly named acceptance draft in the isolated POC.
const base = 'http://127.0.0.1:8098';
let token;
async function api(path, method = 'GET', body, expected = 200) {
  const response = await fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${result.message ?? response.status}`);
  return result.data;
}
const session = await api('/api/v1/auth/login', 'POST', {
  account: 'LDU100001', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-ludong-poc',
});
assert.equal(session.tenantId, 'tenant-ludong-poc');
token = session.accessToken;
const path = '/api/v1/buyer/ludong-poc/applications';
const before = await api(path);
const payload = {
  projectName: `分步草稿验收-${Date.now()}`, applicantUnit: '', departmentId: '', budgetAmount: 0,
  formData: { _draftTab: 'basic', projectLeaderName: '草稿验收负责人' }, items: [],
};
const created = await api(`${path}/drafts`, 'POST', payload);
assert.equal(created.status, 'draft');
assert.equal(Number(created.budgetAmount), 0);
assert.equal((await api(`${path}/${created.id}`)).formData.projectLeaderName, '草稿验收负责人');
payload.formData = { ...payload.formData, _draftTab: 'requirements', purchaseReason: '先保存理由，其他栏目稍后补充' };
payload.items = [{ name: '台式计算机', quantity: '', unitPrice: '', governmentMallCatalogMode: 'auto' }];
const updated = await api(`${path}/${created.id}/draft`, 'PUT', payload);
assert.equal(updated.id, created.id);
assert.equal(updated.status, 'draft');
const reloaded = await api(`${path}/${created.id}`);
assert.equal(reloaded.formData._draftTab, 'requirements');
assert.equal(reloaded.formData.purchaseReason, payload.formData.purchaseReason);
assert.equal(reloaded.items[0].name, '台式计算机');
assert.equal(reloaded.items[0].governmentMallCatalog, '是');
await api(`${path}/${created.id}/submit`, 'POST', undefined, 400);
assert.equal((await api(`${path}/${created.id}`)).status, 'draft');
const after = await api(path);
for (const original of before) {
  assert.deepEqual(after.find((item) => item.id === original.id), original, `Existing application changed: ${original.id}`);
}
assert.equal(after.length, before.length + 1);
const directory = resolve('.ludong-tender-runtime/application-tabs');
mkdirSync(directory, { recursive: true });
const report = { passed: true, applicationId: created.id, applicationNo: created.applicationNo,
  projectName: created.projectName, preservedApplications: before.length, checkedAt: new Date().toISOString(),
  checks: ['partial-create', 'partial-update-same-id', 'reload-fields-and-tab', 'partial-mall-item', 'incomplete-submit-blocked', 'existing-applications-unchanged'] };
writeFileSync(resolve(directory, 'draft-http-result.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
