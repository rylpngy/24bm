import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// This script deliberately refuses the original database/listener, even with write authorization.
const base = new URL(process.env.JAVA_API_BASE_URL ?? '');
assert.equal(base.origin, 'http://127.0.0.1:8095');
assert.equal(process.env.ACCEPTANCE_LOCAL_WRITES, '1');
const database = process.env.ACCEPTANCE_EXPECTED_DB;
assert.match(database ?? '', /^budget_closeout_\d+$/);
const pid = execFileSync('lsof', ['-tiTCP:8095', '-sTCP:LISTEN'], { encoding: 'utf8' }).trim();
assert.match(pid, /^\d+$/);
const runtime = execFileSync('ps', ['eww', '-p', pid, '-o', 'command='], { encoding: 'utf8' });
assert.ok(runtime.includes(`DB_URL=jdbc:postgresql://127.0.0.1:25432/${database} `), 'Wrong isolated database');
assert.ok(!/SPRING_APPLICATION_JSON=|SPRING_DATASOURCE_URL=|--spring\.|-Dspring\./.test(runtime), 'Unsupported runtime overrides');
const password = process.env.ACCEPTANCE_PASSWORD;
assert.ok(password, 'ACCEPTANCE_PASSWORD is required');
const runId = `budget-${Date.now()}`;
const year = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date());
const report = { runId, tenantId: runId, buyerAccount: `${runId}@example.com`, reviewerAccount: `review-${runId}@example.com`, database, checks: [], records: {}, passed: false };
const path = process.env.ACCEPTANCE_REPORT_PATH ?? '.tmp/budget-business-http.json';
async function api(route, token, body, method = body === undefined ? 'GET' : 'POST', expected = [200, 201, 204]) {
  const response = await fetch(`${base.origin}/api/v1/${route}`, { method, signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  assert.ok(expected.includes(response.status), `${method} ${route}: ${response.status} ${payload.message}`);
  return response.ok ? payload.data : { error: true, message: payload.message };
}
const login = (account, scope = 'BUYER', context = { tenantId: runId }) => api('auth/login', null, { account, password, scope, ...context });
const check = name => { report.checks.push(name); console.log(`PASS ${name}`); };
try {
  const platform = await login(process.env.ACCEPTANCE_PLATFORM_ACCOUNT ?? 'platform.admin@example.com', 'PLATFORM', {});
  await api('platform/tenants', platform.accessToken, { tenantId: runId, enterpriseId: `ent-${runId}`, name: `预算业务验收 ${runId}`, industry: '通用采购', plan: 'MVP', userLimit: 20,
    enabledFeatures: ['rfq', 'finance', 'order', 'mall', 'method:compare', 'method:mall'], adminName: '预算经办人', adminEmail: report.buyerAccount, adminPassword: password });
  let owner = await login(report.buyerAccount); let b = owner.accessToken;
  const department = await api('buyer/departments', b, { name: '采购预算部门' });
  report.departmentId = department.id;
  const role = (await api('buyer/roles', b)).find(r => r.permissions.includes('buyer:*')); assert.ok(role);
  await api(`buyer/users/${owner.userId}`, b, { name: '预算经办人', email: report.buyerAccount, departmentId: department.id, roleId: role.id, jobTitle: '采购经办' }, 'PUT');
  owner = await login(report.buyerAccount); b = owner.accessToken;
  const reviewer = await api('buyer/users', b, { name: '独立预算审批人', email: report.reviewerAccount, status: 'active', departmentId: department.id, roleId: role.id, initialPassword: password });
  const r = (await login(report.reviewerAccount)).accessToken;
  report.buyerId = owner.userId; report.reviewerId = reviewer.id;
  for (const businessType of ['budget_change', 'budget_exception', 'purchase_demand', 'buyer_supplier_admission']) {
    const def = await api('buyer/process-definitions', b, { name: `预算验收 ${businessType}`, businessType, icon: 'file-text' });
    await api(`buyer/process-definitions/${def.id}`, b, { name: def.name, businessType, status: 'draft',
      formSchema: JSON.stringify({ fields: businessType.startsWith('budget_') ? [{ id: 'basis', type: 'text', label: '测算依据', required: true }] : [] }),
      flowSchema: JSON.stringify({ steps: [{ id: 'review', type: 'approver', title: '独立审核', assignment: { type: 'role', roleId: role.id } }] }) }, 'PUT');
    await api(`buyer/process-definitions/${def.id}/publish`, b, {});
  }
  const policy = () => api('buyer/budgets/policy', b);
  const position = async () => (await api('buyer/budgets/positions', b)).find(p => p.departmentId === department.id && p.period === year);
  const request = (kind, amount, extra = {}) => api('buyer/budgets/requests', b, { departmentId: department.id, period: year, kind, targetAmount: amount, title: `年度预算${kind}`, reason: '采购计划及实际测算依据', ...extra });
  const submit = id => api(`buyer/budgets/requests/${id}/submit`, b, { formData: { basis: '设备更新计划测算' } });
  const decide = async (record, action = 'approve') => {
    const task = (await api('buyer/workflow/tasks', r)).find(t => t.businessId === record.id); assert.ok(task);
    await api(`buyer/workflow/tasks/${task.taskId}/complete`, r, { action, comment: action === 'approve' ? '测算依据及业务范围审核通过' : '请补正后重新申报' });
    return api(`buyer/budgets/requests/${record.id}`, b);
  };
  const changeMode = async mode => { const current = await policy(); return api('buyer/budgets/policy', b, { mode, revision: current.revision, reason: '隔离环境验证控制策略', acknowledged: true }, 'PUT'); };
  assert.equal((await policy()).mode, 'warning'); check('default remains warning; opening workspace does not create a policy');
  const initial = await request('initial', 1000);
  await api(`buyer/budgets/requests/${initial.id}/submit`, b, { formData: {} }, 'POST', [400]);
  assert.equal((await api(`buyer/budgets/requests/${initial.id}`, b)).status, 'draft');
  await submit(initial.id); assert.ok(!(await position())?.configured);
  const task = (await api('buyer/workflow/tasks', r)).find(t => t.businessId === initial.id); assert.ok(task);
  assert.ok(!(await api('buyer/workflow/tasks', b)).some(t => t.businessId === initial.id));
  await api(`buyer/workflow/tasks/${task.taskId}/complete`, b, { action: 'approve', comment: 'self' }, 'POST', [403]);
  await decide(initial); assert.equal((await position()).totalAmount, 1000);
  report.records.initial = initial.id;
  check('published form is required, self handling denied, real independent approval activates budget');
  const adjust = await request('adjustment', 1500); const stale = await request('adjustment', 1800);
  await submit(adjust.id); await decide(adjust);
  await api(`buyer/budgets/requests/${stale.id}/submit`, b, { formData: { basis: '旧基线' } }, 'POST', [400]);
  const rejected = await request('adjustment', 1600); await submit(rejected.id); await decide(rejected, 'reject');
  const withdrawn = await request('adjustment', 1600); await submit(withdrawn.id);
  await api(`buyer/budgets/requests/${withdrawn.id}/withdraw`, b, { reason: '重新核实测算' });
  assert.equal((await position()).totalAmount, 1500);
  check('adjustment versions prevent stale overwrite; rejection and withdrawal preserve amounts and history');
  const material = await api('buyer/materials', b, { code: runId, name: '预算验收设备', category: '通用采购', unit: '台', referencePrice: 100 });
  const demand = amount => api('buyer/demands', b, { title: `预算设备采购 ${amount}`, departmentId: department.id, budget: amount, purpose: '预算控制真实验收', lineItems: [{ materialId: material.id, quantity: 1 }] });
  const submitDemand = (id, expected) => api(`buyer/demands/${id}/submit`, b, { formData: {} }, 'POST', expected);
  const withdrawDemand = async id => {
    const history = await api(`buyer/workflow/instances/business/purchase_demand/${id}/history`, b);
    return api(`buyer/workflow/instances/${history.workflowInstanceId}/withdraw-purchase-demand`, b, { reason: '核对需求后撤回' });
  };
  const d1 = await demand(1200); await submitDemand(d1.id);
  const d2 = await demand(500); await submitDemand(d2.id);
  assert.equal((await position()).pending, 1700); await withdrawDemand(d2.id); assert.equal((await position()).pending, 1200);
  report.records.demand = d1.id;
  check('warning mode allows overrun with real reservation; withdrawal releases only its own pending amount');
  const p = await policy();
  await api('buyer/budgets/policy', b, { mode: 'hard', revision: p.revision, reason: '缺少确认', acknowledged: false }, 'PUT', [400]);
  await changeMode('hard'); await submitDemand(d2.id, [400]); assert.equal((await position()).pending, 1200);
  assert.equal((await api(`buyer/demands/${d2.id}`, b)).status, '草稿');
  check('hard control requires explicit acknowledgement and rolls back failed submissions');
  await changeMode('approval');
  const extra = { targetType: 'purchase_demand', targetId: d2.id };
  const exception = await request('exception', 1700, extra); await submit(exception.id); await decide(exception);
  await submitDemand(d2.id); assert.ok((await api(`buyer/budgets/requests/${exception.id}`, b)).consumedAt);
  await withdrawDemand(d2.id); await submitDemand(d2.id, [400]);
  const oldGrant = await request('exception', 1700, extra); await submit(oldGrant.id); await decide(oldGrant);
  const newer = await request('adjustment', 1501); await submit(newer.id); await decide(newer);
  await submitDemand(d2.id, [400]);
  check('exception is business-scoped and single-use; unused grants become invalid after budget version change');
  await changeMode('hard');
  const pair = [await demand(200), await demand(200)];
  const outcomes = await Promise.all(pair.map(d => submitDemand(d.id, [200, 201, 400])));
  assert.equal(outcomes.filter(x => x?.error).length, 1); assert.equal((await position()).pending, 1400);
  check('concurrent submissions serialize budget checks: only one fits the remaining balance');
  const supplierId = process.env.ACCEPTANCE_SUPPLIER_ID ?? 'ent-supplier-sunrise';
  const supplier = await login(process.env.ACCEPTANCE_SUPPLIER_ACCOUNT ?? 'supplier.sales@example.com', 'SUPPLIER', { supplierId });
  const s = supplier.accessToken;
  const qualifications = await api('supplier/qualifications?status=active', s);
  if (!qualifications.some(q => !q.expiresAt || q.expiresAt >= new Date().toISOString().slice(0, 10))) {
    const fileName = '隔离验收资质材料.pdf';
    const ticket = await api('supplier/qualifications/upload-ticket', s, { fileName });
    const uploaded = await fetch(`${base.origin}/api/v1/supplier/qualifications/upload-sink?storageKey=${encodeURIComponent(ticket.storageKey)}&contentType=application%2Fpdf`, {
      method: 'POST', headers: { Authorization: `Bearer ${s}`, 'Content-Type': 'application/octet-stream' }, body: Buffer.from('%PDF-1.4\nISOLATED TEST ONLY\n%%EOF') });
    assert.ok(uploaded.ok, 'Isolated qualification upload failed');
    await api('supplier/qualifications', s, { qualificationType: '营业执照', certificateNo: runId, fileName, storageKey: ticket.storageKey,
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10) });
  }
  const relation = await api('buyer/suppliers', b, { supplierId, status: '待准入', level: '普通', categories: ['通用采购'] });
  await api(`buyer/suppliers/${relation.id}/submit`, b, { formData: {} });
  const admission = (await api('buyer/workflow/tasks', r)).find(t => t.businessId === relation.id); assert.ok(admission);
  await api(`buyer/workflow/tasks/${admission.taskId}/complete`, r, { action: 'approve', comment: '供应商准入资料核验通过' });
  const category = (await api(`supplier/mall/categories?tenantId=${runId}`, s)).find(c => c.name === '通用采购'); assert.ok(category);
  let product = await api('supplier/mall/products', s, { tenantId: runId, name: '预算控制商城设备', brand: '验收品牌', categoryId: category.id, descriptionHtml: '<p>实际预算控制验证商品</p>' });
  product = await api(`supplier/mall/products/${product.id}/skus`, s, { skuCode: runId, spec: '{"规格":"标准"}', materialId: material.id, unit: '台', price: 200, minOrderQty: 1, stepQty: 1, stockQty: 10, leadTimeDays: 2, tierPrices: [] });
  await api(`supplier/mall/products/${product.id}/status`, s, { status: '待审核' }, 'PUT');
  await api(`buyer/mall/products/${product.id}/review`, b, { approved: true, comment: '型号价格及供应能力核验' });
  const addresses = await api('buyer/mall/addresses', b, { receiver: '采购经办人', phone: '13800000001', province: '山东省', city: '烟台市', district: '芝罘区', detail: '采购验收中心', isDefault: true });
  const orderBody = { listingId: product.skus[0].id, quantity: 1, addressId: addresses[0].id, remark: '预算控制验收' };
  await api('buyer/mall/orders', b, { ...orderBody, idempotencyKey: runId + '-blocked' }, 'POST', [400]);
  assert.equal((await api('buyer/orders', b)).length, 0);
  assert.equal((await api(`buyer/mall/products/${product.id}`, b)).skus[0].stockQty, 10);
  await changeMode('warning');
  await api('buyer/mall/orders', b, { ...orderBody, idempotencyKey: runId + '-warning' });
  assert.equal((await position()).committed, 200);
  await changeMode('approval');
  const orderGrant = await request('exception', 1800, { targetType: 'department_order', targetId: department.id });
  await submit(orderGrant.id); await decide(orderGrant);
  await api('buyer/mall/orders', b, { ...orderBody, idempotencyKey: runId + '-exception' });
  await api('buyer/mall/orders', b, { ...orderBody, idempotencyKey: runId + '-replay' }, 'POST', [400]);
  assert.equal((await api('buyer/orders', b)).length, 2);
  assert.equal((await api(`buyer/mall/products/${product.id}`, b)).skus[0].stockQty, 8);
  assert.equal((await position()).committed, 400);
  check('real supplier publication and mall checkout enforce budget, roll back stock, assign department and consume one exception');
  await changeMode('warning');
  for (let i = 0; i < 21; i++) await request('adjustment', 1600 + i);
  const first = await api('buyer/budgets/requests?page=1&pageSize=20', b);
  const second = await api('buyer/budgets/requests?page=2&pageSize=20', b);
  assert.ok(first.total > 20 && second.items.length > 0);
  assert.ok(second.items.every(x => !first.items.some(y => y.id === x.id)));
  const foreign = await login(process.env.ACCEPTANCE_FOREIGN_BUYER_ACCOUNT ?? 'buyer.owner@example.com', 'BUYER', { tenantId: 'tenant-acme' });
  await api(`buyer/budgets/requests/${initial.id}`, foreign.accessToken, undefined, 'GET', [400, 403, 404]);
  const file = await fetch(`${base.origin}/api/v1/buyer/budgets/ledger/export?period=${year}`, { headers: { Authorization: `Bearer ${b}` } });
  assert.equal(file.status, 200); const bytes = Buffer.from(await file.arrayBuffer()); assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  mkdirSync(dirname(path), { recursive: true });
  const exportPath = path.replace(/\.json$/, '') + '.xlsx'; writeFileSync(exportPath, bytes);
  report.exportPath = exportPath; report.position = await position(); report.passed = true;
  check('request pagination has no overlap, foreign tenant access denied, real XLSX export generated');
} finally {
  mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(report, null, 2));
}
