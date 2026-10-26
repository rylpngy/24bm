import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = 'http://127.0.0.1:8098';
const checks = [];
async function json(path, token, method = 'GET', body, status = 200) {
  const response = await fetch(base + path, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, status, `${method} ${path}: ${response.status}`);
  checks.push({ path, status });
  return (await response.json()).data;
}
for (const port of [5288, 5289]) {
  const page = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes('id="root"'));
  const health = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
  assert.equal(health.status, 200);
  checks.push({ port, page: 'PASS', apiProxy: 'PASS' });
}
for (const [letter, supplierId] of [['a', 'ent-ldu-demo-a'], ['b', 'ent-ldu-demo-b'], ['c', 'ent-ldu-demo-c']]) {
  const session = await json('/api/v1/auth/login', null, 'POST', {
    account: `ldu.supplier.${letter}@example.com`, password: 'demo123456', scope: 'SUPPLIER', supplierId,
  });
  assert.equal(session.supplierId, supplierId);
  await json('/api/v1/supplier/rfqs', session.accessToken);
}
const login = await json('/api/v1/auth/login', null, 'POST', {
  account: 'LDU000001', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-ludong-poc',
});
const token = login.accessToken;
const applications = await json('/api/v1/buyer/ludong-poc/applications', token);
assert.ok(applications.length >= 5);
const ownerType = 'ludong_poc_project_attachment';
const ownerId = applications[0].id;
const fileName = `POC环境附件核验-${Date.now()}.txt`;
const content = Buffer.from('鲁东大学正式磋商POC独立环境附件核验。此文件为合成测试资料，不代表真实项目材料。', 'utf8');
const metadata = { ownerType, ownerId, fileName, visibility: 'buyer_internal' };
const ticket = await json('/api/v1/buyer/attachments/upload-ticket', token, 'POST', metadata);
const uploadUrl = new URL(ticket.uploadUrl, base);
assert.equal(uploadUrl.origin, base, 'Upload may only target this isolated API');
uploadUrl.searchParams.set('contentType', 'text/plain');
const uploaded = await fetch(uploadUrl, { method: 'POST', headers: {
  Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream',
}, body: content });
assert.equal(uploaded.status, 200);
const attachment = await json('/api/v1/buyer/attachments', token, 'POST', { ...metadata, storageKey: ticket.storageKey }, 201);
const downloaded = await fetch(`${base}/api/v1/buyer/attachments/${attachment.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
assert.equal(downloaded.status, 200);
const received = Buffer.from(await downloaded.arrayBuffer());
assert.equal(createHash('sha256').update(received).digest('hex'), createHash('sha256').update(content).digest('hex'));
const integrity = await json(`/api/v1/buyer/attachments/${attachment.id}/integrity-check`, token, 'POST');
checks.push({ attachmentId: attachment.id, uploadDownloadSha256: 'MATCH', integrity });
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
writeFileSync(resolve(root, '.ludong-tender-runtime/environment-smoke.json'), JSON.stringify({ result: 'PASS', at: new Date().toISOString(), checks }, null, 2));
console.log('PASS: both portal proxies, three real supplier logins, school seed data, isolated MinIO upload/download byte integrity.');
