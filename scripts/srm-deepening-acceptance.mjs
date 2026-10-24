import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const base = process.env.JAVA_API_BASE_URL;
assert.equal(base, 'http://127.0.0.1:8095'); assert.equal(process.env.ACCEPTANCE_LOCAL_WRITES, '1');
const database = process.env.ACCEPTANCE_EXPECTED_DB; assert.match(database ?? '', /^srm_deepening_\d+$/);
const pid = execFileSync('lsof', ['-tiTCP:8095', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim(); assert.match(pid, /^\d+$/);
const runtime = execFileSync('ps', ['eww', '-p', pid, '-o', 'command='], { encoding: 'utf8' });
assert.ok(runtime.includes(`DB_URL=jdbc:postgresql://127.0.0.1:25432/${database} `), 'Wrong isolated database');
assert.ok(!/SPRING_APPLICATION_JSON=|SPRING_DATASOURCE_URL=|--spring\.|-Dspring\./.test(runtime), 'Unsupported overrides');
const password = process.env.ACCEPTANCE_PASSWORD, python = process.env.ACCEPTANCE_PYTHON;
assert.ok(password && python, 'Provide ACCEPTANCE_PASSWORD and ACCEPTANCE_PYTHON with openpyxl');
const runId = `srm-deep-${Date.now()}`;
const supplierId = process.env.ACCEPTANCE_SUPPLIER_ID ?? 'ent-supplier-sunrise';
const reportPath = process.env.ACCEPTANCE_REPORT_PATH ?? '.tmp/srm2-http.json';
const report = { runId, database, tenantId: runId, buyerAccount: runId + '@example.com', reviewerAccount: 'review-' + runId + '@example.com', secondAccount: 'second-' + runId + '@example.com', supplierId, records: {}, checks: [], passed: false };
const future = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const check = name => { report.checks.push(name); console.log('PASS ' + name); };
async function api(path, token, data, method = data === undefined ? 'GET' : 'POST', expected = [200, 201]) {
  const r = await fetch(base + '/api/v1/' + path, { method, signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
  const text = await r.text(); const json = text ? JSON.parse(text) : {};
  assert.ok(expected.includes(r.status), `${method} ${path}: ${r.status} ${json.message}`); return json.data;
}
const login = (account, scope = 'BUYER', context = { tenantId: runId }) => api('auth/login', null, { account, password, scope, ...context });
function workbook(headers, rows) {
  return execFileSync(python, ['-c', 'import sys,json,io,openpyxl\np=json.load(sys.stdin);w=openpyxl.Workbook();s=w.active;s.append(p["headers"])\nfor r in p["rows"]:s.append(r)\nb=io.BytesIO();w.save(b);sys.stdout.buffer.write(b.getvalue())'], { input: JSON.stringify({ headers, rows }), maxBuffer: 4 * 1024 * 1024 });
}
async function importFile(path, token, bytes) {
  const r = await fetch(base + '/api/v1/' + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: bytes }); const result = await r.json(); assert.ok(r.ok, result.message); return result.data;
}
try {
  mkdirSync(dirname(reportPath), { recursive: true });
  const platform = await login(process.env.ACCEPTANCE_PLATFORM_ACCOUNT ?? 'platform.admin@example.com', 'PLATFORM', {});
  const supplier = await login(process.env.ACCEPTANCE_SUPPLIER_ACCOUNT ?? 'supplier.sales@example.com', 'SUPPLIER', { supplierId }); const s = supplier.accessToken;
  await api('platform/tenants', platform.accessToken, { tenantId: runId, enterpriseId: 'ent-' + runId, name: 'SRM业务深化 ' + runId, industry: '通用采购', plan: 'MVP', userLimit: 20, enabledFeatures: ['rfq', 'order', 'finance'], adminName: '供应商管理员', adminEmail: report.buyerAccount, adminPassword: password });
  const buyer = await login(report.buyerAccount); let b = buyer.accessToken; report.buyerId = buyer.userId;
  const department = await api('buyer/departments', b, { name: '供应商管理部' }); report.departmentId = department.id;
  const ownerRole = (await api('buyer/roles', b)).find(r => r.permissions.includes('buyer:*')); assert.ok(ownerRole);
  await api('buyer/users/' + buyer.userId, b, { name: '供应商管理员', email: report.buyerAccount, departmentId: department.id, roleId: ownerRole.id }, 'PUT');
  b = (await login(report.buyerAccount)).accessToken;
  const reviewerRole = await api('buyer/roles', b, { name: '资质审批人', permissions: ['buyer:supplier:read', 'buyer:workflow:read', 'buyer:workflow:review'], dataScope: 'all' });
  for (const [name, email] of [['一级核验人', report.reviewerAccount], ['二级核验人', report.secondAccount]]) await api('buyer/users', b, { name, email, departmentId: department.id, roleId: reviewerRole.id, status: 'active', initialPassword: password });
  const r = (await login(report.reviewerAccount)).accessToken, r2 = (await login(report.secondAccount)).accessToken;
  const template = await fetch(base + '/api/v1/buyer/suppliers/import-template', { headers: { Authorization: `Bearer ${b}` } }); assert.equal(template.status, 200); assert.equal(Buffer.from(await template.arrayBuffer()).subarray(0, 2).toString(), 'PK');
  const bytes = workbook(['公共供应商编号*', '分级*', '授权品类*(分号分隔)', '联系人', '联系电话', '邮箱', '经营范围'], [[supplierId, '普通', '通用采购;办公用品', '隔离联系人', '13800000000', 'contact@example.com', '采购服务'], [supplierId, '普通', '通用采购', '', '', '', ''], ['missing-' + runId, '普通', '通用采购', '', '', '', '']]);
  const imported = await importFile('buyer/suppliers/import', b, bytes); assert.equal(imported.successCount, 1); assert.equal(imported.failures.length, 2); assert.equal(imported.totalRows, 3);
  const relation = (await api('buyer/suppliers', b)).find(x => x.supplierId === supplierId); assert.equal(relation.status, '待准入'); report.records.relationId = relation.id;
  check('supplier import validates rows, reports duplicates/missing suppliers and never auto-admits');
  const materialBytes = workbook(['物料编码*', '物料名称*', '分类*', '计量单位*', '参考价', '规格型号', '品牌', '省政府网上商城目录(是/否)', '税率(%)', '描述'], [['MAT-' + runId, '测试办公设备', '办公用品', '台', '100', '标准', '测试', '否', '13', '隔离数据'], ['BAD-' + runId, '坏价格', '办公用品', '台', 'not-number', '', '', '否', '', '']]);
  const materials = await importFile('buyer/materials/import', b, materialBytes); assert.equal(materials.successCount, 1); assert.equal(materials.failures.length, 1);
  check('existing material import still reports partial success and rejects invalid prices');
  async function upload(previous) {
    const fileName = '测试证照-' + Date.now() + '.pdf', content = Buffer.from('%PDF-1.4\nISOLATED SRM DOCUMENT ' + fileName + '\n%%EOF');
    const ticket = await api('supplier/qualifications/upload-ticket', s, { fileName });
    const u = await fetch(base + ticket.uploadUrl + '&contentType=application%2Fpdf', { method: 'POST', headers: { Authorization: `Bearer ${s}`, 'Content-Type': 'application/octet-stream' }, body: content }); assert.ok(u.ok, 'Original upload failed');
    const q = await api('supplier/qualifications' + (previous ? '/' + previous + '/replacement' : ''), s, { qualificationType: '营业执照', certificateNo: 'SRM-' + Date.now(), expiresAt: future(365), fileName, storageKey: ticket.storageKey });
    report.records.originalHashes ??= {}; report.records.originalHashes[q.id] = createHash('sha256').update(content).digest('hex'); return q;
  }
  const old = await upload(); report.records.oldQualificationId = old.id;
  async function publish(type, roleId, steps, id) {
    const definition = id ? { id, name: '资质变更审批' } : await api('buyer/process-definitions', b, { name: 'SRM ' + type, businessType: type, icon: 'file-text' });
    await api('buyer/process-definitions/' + definition.id, b, { name: definition.name, businessType: type, status: 'draft', formSchema: JSON.stringify({ fields: type === 'supplier_qualification_change' ? [{ id: 'basis', type: 'text', label: '原件核验依据', required: true }] : [] }), flowSchema: JSON.stringify({ steps: Array.from({ length: steps }, (_, i) => ({ id: 'review' + i, type: 'approver', title: '第' + (i + 1) + '级资质核验', assignment: { type: 'role', roleId } })) }) }, 'PUT');
    await api('buyer/process-definitions/' + definition.id + '/publish', b, {}); return definition.id;
  }
  await publish('buyer_supplier_admission', ownerRole.id, 1);
  const definitionId = await publish('supplier_qualification_change', reviewerRole.id, 2); report.records.definitionId = definitionId;
  await api('buyer/suppliers/' + relation.id + '/submit', b, { formData: {} });
  const admission = (await api('buyer/workflow/tasks', b)).find(t => t.businessId === relation.id); assert.ok(admission); await api('buyer/workflow/tasks/' + admission.taskId + '/complete', b, { action: 'approve', comment: '原始资质准入核验' });
  const task = await api('buyer/suppliers/qualification-supplements', b, { relationId: relation.id, qualificationId: old.id, reason: '请补充新有效期证照原件', dueDate: future(7) }); report.records.supplementId = task.id;
  await api('buyer/suppliers/qualification-supplements', b, { relationId: relation.id, qualificationId: old.id, reason: '重复任务', dueDate: future(7) }, 'POST', [400]);
  assert.ok((await api('supplier/notifications', s)).some(n => n.title === '资质补件通知'));
  const next = await upload(old.id); const reviews = () => api('buyer/suppliers/qualification-reviews', b);
  const review = (await reviews()).find(x => x.qualificationId === next.id); assert.ok(review); report.records.firstReviewId = review.id;
  await api('supplier/qualifications/supplements/' + task.id + '/reply', s, { replacementId: next.id, response: '已上传新原件', revision: 0 });
  await api('supplier/qualifications/supplements/' + task.id + '/reply', s, { replacementId: next.id, response: '重复回复', revision: 0 }, 'POST', [400]);
  check('buyer deadline task reaches real supplier recipient; supplier attaches a versioned original and stale replies fail');
  const start = (id, expected) => api('buyer/suppliers/qualification-reviews/' + id + '/workflows', b, { reason: '新旧证照与有效期核验', formData: { basis: '工商登记原件及证照有效期' } }, 'POST', expected);
  const decide = async (attempt, token, action = 'approve', expected) => {
    const current = (await api('buyer/workflow/tasks', token)).find(t => t.businessId === attempt.id); assert.ok(current, 'Missing actual workflow task');
    return api('buyer/workflow/tasks/' + current.taskId + '/complete', token, { action, comment: action === 'approve' ? '新旧原件核验通过' : '请补充清晰证照后重新提交' }, 'POST', expected);
  };
  await api('buyer/suppliers/qualification-reviews/' + review.id + '/review', b, { approved: true, comment: '直接绕过' }, 'POST', [400]);
  await api('buyer/suppliers/qualification-reviews/' + review.id + '/workflows', b, { reason: '缺少核验依据', formData: {} }, 'POST', [400]);
  assert.equal((await api('buyer/suppliers/qualification-reviews/' + review.id + '/workflows', b)).total, 0);
  const a = await start(review.id); await start(review.id, [400]);
  const firstTask = (await api('buyer/workflow/tasks', r)).find(t => t.businessId === a.id); assert.ok(firstTask);
  await api('buyer/workflow/tasks/' + firstTask.taskId + '/complete', b, { action: 'approve', comment: '非候选人办理' }, 'POST', [403]);
  await decide(a, r); assert.equal((await reviews()).find(x => x.id === review.id).status, 'pending');
  await decide(a, r2, 'reject'); assert.equal((await reviews()).find(x => x.id === review.id).status, 'rejected');
  const returned = (await api('supplier/qualifications/supplements', s)).items.find(x => x.id === task.id); assert.equal(returned.status, 'returned');
  check('direct bypass, missing form and non-candidate handling denied; intermediate approval does not activate change; rejection returns supplement');
  const corrected = await upload(next.id); await api('supplier/qualifications/supplements/' + task.id + '/reply', s, { replacementId: corrected.id, response: '补正清晰原件', revision: returned.revision });
  const review2 = (await reviews()).find(x => x.qualificationId === corrected.id); const a2 = await start(review2.id);
  await decide(a2, r); await decide(a2, r2);
  assert.equal((await reviews()).find(x => x.id === review2.id).status, 'approved');
  assert.equal((await api('supplier/qualifications/supplements', s)).items.find(x => x.id === task.id).status, 'closed');
  const history = await api('buyer/workflow/instances/' + a2.workflowInstanceId + '/history', b); assert.equal(history.events.filter(e => e.action === 'approved').length, 2); assert.equal(history.formData.basis, '工商登记原件及证照有效期');
  for (const id of [old.id, next.id, corrected.id]) { const file = await fetch(base + '/api/v1/buyer/suppliers/' + relation.id + '/qualifications/' + id + '/download', { headers: { Authorization: `Bearer ${b}` } }); assert.equal(file.status, 200); assert.equal(createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex'), report.records.originalHashes[id]); }
  check('two-step final approval closes supplement; original versions, comments, form and exact downloaded bytes retained');
  const obsolete = await upload(corrected.id), obsoleteReview = (await reviews()).find(x => x.qualificationId === obsolete.id), obsoleteFlow = await start(obsoleteReview.id);
  const latest = await upload(obsolete.id); await decide(obsoleteFlow, r, 'approve', [400]);
  await api('buyer/suppliers/qualification-workflows/' + obsoleteFlow.id + '/cancel', b, { reason: '材料再次更新，取消旧版流程' });
  assert.equal((await api('buyer/workflow/instances/' + obsoleteFlow.workflowInstanceId + '/history', b)).status, 'cancelled');
  check('superseded originals cannot advance an intermediate node; cancelled workflow stays auditable');
  await publish('supplier_qualification_change', reviewerRole.id, 3, definitionId);
  const latestReview = (await reviews()).find(x => x.qualificationId === latest.id), pending = await start(latestReview.id);
  report.records.pendingReviewId = latestReview.id; report.records.pendingAttempt = pending; report.records.latestQualificationId = latest.id;
  const changed = await api('buyer/workflow/instances/' + pending.workflowInstanceId + '/history', b); assert.ok(changed.currentTask.taskName.includes('第1级'));
  const foreign = await login(process.env.ACCEPTANCE_FOREIGN_BUYER_ACCOUNT ?? 'buyer.owner@example.com', 'BUYER', { tenantId: 'tenant-acme' });
  await api('buyer/suppliers/qualification-reviews/' + latestReview.id + '/workflows', foreign.accessToken, undefined, 'GET', [400, 403, 404]);
  const past = await api('buyer/workflow/instances/' + a2.workflowInstanceId + '/history', b); assert.equal(past.events.filter(e => e.action === 'approved').length, 2);
  report.passed = true; check('new published three-node version used by a new instance, prior two-node history unchanged; foreign tenant denied');
} finally { writeFileSync(reportPath, JSON.stringify(report, null, 2)); }
