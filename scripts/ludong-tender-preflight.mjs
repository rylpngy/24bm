import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = resolve(root, '.ludong-tender-runtime');
const base = 'http://127.0.0.1:8098';
const checks = [];
const read = (path) => JSON.parse(readFileSync(resolve(runtime, path), 'utf8'));
async function check(name, action) {
  try { checks.push({ name, status: 'PASS', detail: await action() }); }
  catch (error) { checks.push({ name, status: 'FAIL', detail: error.message }); }
}
async function request(path, token, body) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET', redirect: 'error',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200, `${path} HTTP ${response.status}`);
  return (await response.json()).data;
}
// Only authentication creates server-side session records; no business writes or model calls.
for (const port of [5288, 5289, 5173, 8080, 8098]) {
  await check(`service:${port}`, async () => {
    const path = [8080, 8098].includes(port) ? '/api/v1/health' : '/';
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200);
    return 'HTTP 200; availability only';
  });
}
for (const port of [5288, 5289]) {
  await check(`proxy:${port}`, async () => {
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/v1/health`, { signal: AbortSignal.timeout(10000) })).status, 200);
  });
}
let token;
await check('buyer-login', async () => {
  const session = await request('/api/v1/auth/login', null, { account: 'LDU000001', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-ludong-poc' });
  token = session.accessToken;
  assert.ok(token);
});
for (const letter of ['a', 'b', 'c']) {
  await check(`supplier-${letter}`, async () => {
    const supplierId = `ent-ldu-demo-${letter}`;
    const session = await request('/api/v1/auth/login', null, { account: `ldu.supplier.${letter}@example.com`, password: 'demo123456', scope: 'SUPPLIER', supplierId });
    assert.equal(session.supplierId, supplierId);
    await request('/api/v1/supplier/rfqs', session.accessToken);
  });
}
await check('ready-approval-sample', async () => {
  assert.ok(token);
  const sample = read('final-acceptance/demo-ready.json');
  const history = await request(`/api/v1/buyer/workflow/instances/business/ludong_project_application/${sample.applicationId}/history`, token);
  assert.ok(history.currentTask, 'Ready sample has already finished');
  assert.match(history.currentTask.taskDefinitionKey, /argumentation_review$/, 'Ready sample has advanced; select a new sample before rehearsal');
  return { applicationNo: sample.applicationNo, node: history.currentTask.taskDefinitionKey };
});
await check('archived-sample-and-downloads', async () => {
  assert.ok(token);
  const sample = read('final-acceptance/result.json');
  const history = await request(`/api/v1/buyer/workflow/instances/business/ludong_project_application/${sample.applicationId}/history`, token);
  assert.equal(history.status, 'approved');
  const files = [];
  for (const kind of ['demand.docx', 'application.docx', 'archive.zip']) {
    const response = await fetch(`${base}/api/v1/buyer/ludong-poc/applications/${sample.applicationId}/documents/${kind}`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, 2).toString(), 'PK');
    files.push({ kind, bytes: bytes.length });
  }
  return { applicationNo: sample.applicationNo, files };
});
await check('contract-review-history', async () => {
  assert.ok(token);
  const documentId = 'crdoc-2e669db7-e175-4cc6-b69e-46e7236b686f';
  const document = await request(`/api/v1/buyer/contract-review/documents/${documentId}`, token);
  assert.ok(document.decisions.some(d => d.newVersion > d.oldVersion && d.beforeText && d.afterText && d.actorId), 'Missing human revision history');
  return { documentId, decisions: document.decisions.length, note: 'Saved history only; no new model call' };
});
await check('live-quotation-sample', async () => {
  assert.ok(token);
  const { rfqId } = read('quotation-acceptance/ui-fixture.json');
  const rfq = (await request('/api/v1/buyer/rfqs', token)).find(item => item.id === rfqId);
  assert.ok(rfq, 'Live quotation sample not found');
  assert.equal(rfq.status, '报价中', 'The live sample is no longer open for quotation');
  const pack = await request(`/api/v1/buyer/rfqs/${rfqId}/quotation-package`, token);
  assert.ok(pack.policy.fullQuoteRequired, 'Full quotation mode is not enabled');
  const hoursRemaining = (Date.parse(pack.deadlineAt) - Date.now()) / 3600000;
  assert.ok(hoursRemaining >= 24, 'Quotation deadline is less than 24 hours away: use the normal extension process or select another sample; never reset data');
  return { rfqId, deadline: pack.deadlineAt, hoursRemaining: Math.floor(hoursRemaining) };
});
await check('frozen-artifacts', async () => {
  const latest = readdirSync(resolve(runtime, 'backups')).filter(name => /^\d+$/.test(name)).sort((a, b) => Number(b) - Number(a))[0];
  assert.ok(latest, 'No backup found');
  const directory = resolve(runtime, 'backups', latest);
  const entries = read(`backups/${latest}/artifacts.json`);
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    const file = resolve(directory, entry.path);
    assert.ok(file.startsWith(directory + sep), 'Invalid artifact path');
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), entry.sha256, entry.path);
  }
  return { backup: latest, verifiedFiles: entries.length };
});
const result = { at: new Date().toISOString(), result: checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL', checks,
  limits: ['Not a narrated timed rehearsal', 'No fresh model availability assertion', 'No business data modified; login sessions may be recorded', 'Formal school policy and venue network still require confirmation'] };
mkdirSync(runtime, { recursive: true });
writeFileSync(resolve(runtime, 'preflight-result.json'), JSON.stringify(result, null, 2));
for (const item of checks) console.log(`${item.status} ${item.name}${item.status === 'FAIL' ? `: ${item.detail}` : ''}`);
process.exitCode = result.result === 'PASS' ? 0 : 1;
