import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { validateBase, validateDatabase } from './mall-procurement-stage-three-acceptance.mjs';

const base = validateBase(process.env.JAVA_API_BASE_URL);
assert.equal(process.env.ACCEPTANCE_LOCAL_WRITES, '1');
assert.equal(process.env.ACCEPTANCE_STAGE_FOUR_READY, '1');
const database = process.env.ACCEPTANCE_EXPECTED_DB;
const expectedHash = process.env.ACCEPTANCE_BACKEND_SHA256;
assert.match(expectedHash ?? '', /^[a-f0-9]{64}$/);
const password = process.env.ACCEPTANCE_PASSWORD;
assert.ok(password);
const command = (name, args) => execFileSync(name, args, { encoding: 'utf8' });
const pid = command('lsof', ['-tiTCP:8095', '-sTCP:LISTEN']).trim();
assert.match(pid, /^\d+$/);
const identity = () => {
  const line = command('ps', ['eww', '-p', pid, '-o', 'command=']);
  const env = key => line.match(new RegExp(`(?:^|\\s)${key}=([^\\s]+)`))?.[1];
  validateDatabase(env('DB_URL'), database);
  assert.equal(env('SERVER_PORT'), '8095');
  assert.equal(env('PROCUREMENT_AI_ENABLED'), 'false', 'This acceptance must never invoke an external AI provider');
  assert.ok(!/--spring\.|-Dspring\.|--server\.|-Dserver\./.test(line));
  for (const key of ['SPRING_DATASOURCE_URL', 'SPRING_APPLICATION_JSON', 'SPRING_CONFIG_LOCATION', 'SPRING_CONFIG_ADDITIONAL_LOCATION']) assert.ok(!env(key));
  const jar = line.match(/(?:^|\s)-jar\s+(\S+\.jar)/)?.[1]; assert.ok(jar?.startsWith('/'));
  return jar;
};
const jar = identity();
assert.equal(createHash('sha256').update(readFileSync(jar)).digest('hex'), expectedHash);
const runId = `platform4-${Date.now()}`;
const report = { passed: false, runId, tenantId: runId, buyerAccount: `${runId}@example.com`, database, jarHash: expectedHash, checks: [], records: {}, requests: [] };
const output = process.env.ACCEPTANCE_REPORT_PATH ?? `.tmp/${runId}.json`;
const checkpoint = () => writeFileSync(output, JSON.stringify(report, null, 2), { mode: 0o600 });
const check = text => { report.checks.push(text); checkpoint(); };
async function request(path, token, method = 'GET', data, expected = [200, 201]) {
  assert.equal(identity(), jar);
  const response = await fetch(`${base}/api/v1/${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: data === undefined ? undefined : JSON.stringify(data), redirect: 'error', signal: AbortSignal.timeout(30000) });
  const body = await response.json(); report.requests.push({ method, path: path.split('?')[0], status: response.status });
  assert.ok(expected.includes(response.status), `${method} ${path.split('?')[0]} returned ${response.status}: ${body.message ?? 'unexpected status'}`);
  return expected.some(status => status >= 400) && response.status >= 400 ? body : body.data;
}
const login = (account, scope, context = {}) => request('auth/login', null, 'POST', { account, password, scope, ...context });
try {
  const platform = (await login('platform.admin@example.com', 'PLATFORM')).accessToken;
  const foreign = (await login('buyer.owner@example.com', 'BUYER', { tenantId: 'tenant-acme' })).accessToken;
  const catalog = await request('platform/tenants/configuration-catalog', platform);
  assert.ok(catalog);
  await request('platform/tenants', platform, 'POST', { tenantId: runId, enterpriseId: `ent-${runId}`, name: '平台统计AI隔离验收', industry: '验收', plan: 'MVP', userLimit: 20, enabledFeatures: ['rfq', 'order', 'finance'], adminName: '隔离验收管理员', adminEmail: report.buyerAccount, adminPassword: password });
  const session = await login(report.buyerAccount, 'BUYER', { tenantId: runId }), token = session.accessToken;
  const current = await request(`platform/tenants/${runId}`, platform);
  await request(`platform/tenants/${runId}/configuration`, platform, 'PUT', { plan: 'Enterprise', userLimit: 30, enabledFeatures: ['unknown-feature'] }, [400]);
  const unchanged = await request(`platform/tenants/${runId}`, platform);
  assert.equal(unchanged.plan, current.plan); assert.equal(unchanged.userLimit, current.userLimit);
  check('invalid combined configuration cannot partially change plan or user limit');
  await request(`platform/tenants/${runId}/configuration`, platform, 'PUT', { plan: '标准版', userLimit: 20, enabledFeatures: ['rfq', 'order', 'finance', 'method:none'] });
  const disabled = await request('buyer/capabilities', token);
  assert.equal(disabled.methods.length, 0);
  await request(`platform/tenants/${runId}/configuration`, platform, 'PUT', { plan: 'Growth', userLimit: 20, enabledFeatures: ['rfq', 'order', 'finance'] });
  const inherited = await request('buyer/capabilities', token);
  assert.ok(inherited.methods.length > 0);
  check('explicit no-method configuration differs from legacy inherited defaults');
  const department = await request('buyer/departments', token, 'POST', { name: '平台验收部门' });
  const material = await request('buyer/materials', token, 'POST', { code: runId, name: '验收办公设备', category: '办公设备', unit: '台', referencePrice: 1000 });
  const roles = await request('buyer/roles', token), admin = roles.find(role => role.permissions.includes('buyer:*'));
  assert.ok(admin?.protectedRole);
  await request(`buyer/users/${session.userId}/status`, token, 'POST', { status: 'inactive' }, [400]);
  await request(`buyer/roles/${admin.id}/permissions`, token, 'POST', { permissions: ['buyer:demand:read'] }, [400]);
  check('real provisioned owner role and final active administrator are protected');
  const rule = { prefix: 'POC4-', dateFormat: 'yyyyMMdd', width: 4, enabled: true };
  const preview = await request('buyer/numbering-rules/demand/preview', token, 'POST', rule);
  assert.equal(preview.consumesSequence, false);
  await request('buyer/numbering-rules/demand', token, 'PUT', rule);
  const draft = { title: '平台验收采购需求', departmentId: department.id, budget: 2000, lineItems: [{ materialId: material.id, quantity: 2 }], purpose: '业务验收' };
  const demand = await request('buyer/demands', token, 'POST', draft);
  assert.ok(demand.id.startsWith('POC4-'));
  const rfq = await request('buyer/rfqs', token, 'POST', { title: '平台验收直录询比', method: '询比', deadlineAt: new Date(Date.now() + 86400000).toISOString(), saveAsDraft: true, directDepartmentId: department.id, directBudget: 2000, directItems: [{ materialId: material.id, quantity: 2 }], invitedSupplierIds: [] });
  const demands = await request('buyer/demands', token);
  const direct = demands.find(item => item.id !== demand.id && item.linkedRfqId === rfq.id);
  assert.ok(direct?.id.startsWith('POC4-')); assert.notEqual(demand.id, direct.id);
  check('configured demand format affects ordinary and direct demand creation without consuming preview sequence');
  Object.assign(report.records, { departmentId: department.id, materialId: material.id, demandId: demand.id, rfqId: rfq.id });
  const supplier = await request('buyer/suppliers', token, 'POST', { supplierId: 'ent-supplier-sunrise', status: '待准入', level: '普通', categories: ['办公设备'] });
  report.records.supplierRelationId = supplier.id;
  const attachmentOwner = { ownerType: 'supplier', ownerId: 'ent-supplier-sunrise' };
  const ticket = await request('buyer/attachments/upload-ticket', token, 'POST', { ...attachmentOwner, fileName: '采购文件待复核.txt', visibility: 'buyer_internal' });
  const upload = new URL(ticket.uploadUrl, base); assert.equal(upload.origin, base);
  const content = Buffer.from('采购文件\n交付地点：待填写\n验收标准：待补充\n');
  upload.searchParams.set('contentType', 'text/plain');
  const uploaded = await fetch(upload, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: content, redirect: 'error' }); assert.ok(uploaded.ok);
  const attachment = await request('buyer/attachments', token, 'POST', { ...attachmentOwner, fileName: '采购文件待复核.txt', storageKey: ticket.storageKey, visibility: 'buyer_internal' });
  report.records.attachmentId = attachment.id;
  const policy = await request('buyer/ai/policies', token, 'POST', { policyKey: 'procurement', title: '验收企业采购管理办法', subjectTypes: ['demand', 'attachment', 'supplier', 'procurement_risk'], clauses: [{ id: 'review', title: '资料核查', text: '申报材料、供应商资质和履约资料需由授权人员核对，AI仅提供复核线索。' }], expectedLatestVersion: 0 });
  await request(`buyer/ai/policies/${policy.id}/publish`, token, 'POST');
  report.records.policyId = policy.id; report.records.runs = {};
  for (const [subjectType, subjectId] of [['demand', demand.id], ['attachment', attachment.id], ['supplier', supplier.id], ['procurement_risk', rfq.id]]) {
    const run = await request('buyer/ai/reviews', token, 'POST', { subjectType, subjectId });
    assert.equal(run.mode, 'RULE_ASSISTED'); assert.equal(run.subjectId, subjectId); assert.ok(run.sourceRevision);
    assert.ok(run.evidence.some(evidence => evidence.kind === 'POLICY' && evidence.policyVersion));
    assert.ok(run.limitations.length); report.records.runs[subjectType] = run.runId;
    const saved = await request(`buyer/ai/reviews/${run.runId}`, token); assert.equal(saved.sourceRevision, run.sourceRevision);
    await request(`buyer/ai/reviews/${run.runId}`, foreign, 'GET', undefined, [400, 403, 404]);
    await request(`buyer/ai/reviews/${run.runId}/feedback`, token, 'POST', { findingId: 'forged-finding', disposition: 'adopted' }, [400]);
    if (run.findings.length) {
      const feedback = await request(`buyer/ai/reviews/${run.runId}/feedback`, token, 'POST', { findingId: run.findings[0].id, disposition: 'needs_review', comment: '人工复核记录' });
      assert.ok(feedback.feedback.some(item => item.findingId === run.findings[0].id));
    }
    check(`${subjectType} evidence, policy version, immutable history, tenant isolation and feedback validated`);
  }
  const stillDraft = (await request('buyer/demands', token)).find(item => item.id === demand.id); assert.equal(stillDraft.status, '草稿');
  const invalidRevision = await request('buyer/ai/reviews', token, 'POST', { subjectType: 'demand', subjectId: demand.id, expectedRevision: 'stale-revision' }, [409]); assert.equal(invalidRevision.success, false);
  check('AI feedback never approves business documents and stale source revision conflicts explicitly');
  const year = new Date().getFullYear();
  const analytics = await request(`buyer/analytics/procurement?fromDate=${year}-01-01&toDate=${year}-12-31`, token);
  assert.equal(analytics.metadata.timezone, 'Asia/Shanghai'); assert.equal(analytics.monthlySpend.length, 12); assert.equal(analytics.orderCount, 0);
  assert.ok(analytics.metadata.orderAmountBasis && analytics.metadata.estimateBoundary);
  await request('buyer/analytics/procurement?fromDate=2000-01-01&toDate=2026-12-31', token, 'GET', undefined, [400]);
  for (const format of ['xlsx', 'pdf']) {
    const response = await fetch(`${base}/api/v1/buyer/reports/procurement-analytics?format=${format}&fromDate=${year}-01-01&toDate=${year}-12-31`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200); const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(format === 'xlsx' ? bytes.subarray(0, 2).toString() === 'PK' : bytes.subarray(0, 4).toString() === '%PDF');
  }
  check('analytics filters, zero months, explicit amount basis, bounded range and actual XLSX/PDF exports');
  report.passed = true;
} catch (error) { report.error = error.message; process.exitCode = 1; }
finally { checkpoint(); console.log(JSON.stringify({ passed: report.passed, reportPath: output, checks: report.checks.length, records: report.records, ...(report.error ? { error: report.error } : {}) })); }
