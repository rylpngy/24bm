import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

// This writes only to a deliberately selected local acceptance environment.
const base = process.env.JAVA_API_BASE_URL;
assert.ok(base && ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)
  && process.env.ACCEPTANCE_LOCAL_WRITES === '1',
  'Set JAVA_API_BASE_URL to an isolated local API and ACCEPTANCE_LOCAL_WRITES=1.');
const required = (name) => { assert.ok(process.env[name], `Missing ${name}`); return process.env[name]; };
const platformAccount = required('ACCEPTANCE_PLATFORM_ACCOUNT');
const platformPassword = required('ACCEPTANCE_PLATFORM_PASSWORD');
const supplierAccount = required('ACCEPTANCE_SUPPLIER_ACCOUNT');
const supplierPassword = required('ACCEPTANCE_SUPPLIER_PASSWORD');
const supplierId = required('ACCEPTANCE_SUPPLIER_ID');
const password = required('ACCEPTANCE_BUYER_PASSWORD');
const runId = `qa-loop-${Date.now()}`;
const report = { runId, base, tenantId: runId, checks: [], records: {}, passed: false };
const day = (days) => new Date(Date.now() + days * 86400000).toISOString();

async function request(path, token, body, method = body === undefined ? 'GET' : 'POST', expected = [200, 201]) {
  const response = await fetch(`${base}/api/v1/${path}`, {
    method, signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  assert.ok(expected.includes(response.status), `${method} ${path}: ${response.status} ${payload.message}`);
  if (response.ok) assert.equal(payload.success, true, `${method} ${path}: ${payload.message}`);
  return payload.data;
}
const check = (name) => { report.checks.push(name); console.log(`PASS ${name}`); };
const login = (account, pwd, scope, context = {}) => request('auth/login', null, { account, password: pwd, scope, ...context });
async function complete(token, businessType, businessId) {
  const tasks = await request('buyer/workflow/tasks', token);
  const task = tasks.find(t => t.businessType === businessType && t.businessId === businessId);
  assert.ok(task, `Missing Flowable task: ${businessType}/${businessId}`);
  const result = await request(`buyer/workflow/tasks/${task.taskId}/complete`, token,
    { action: 'approve', comment: '跨端验收审批通过' });
  assert.equal(result.status, 'approved');
  assert.ok(!(await request('buyer/workflow/tasks', token)).some(t => t.taskId === task.taskId));
  check(`Flowable ${businessType} completed`);
}

try {
  const platform = await login(platformAccount, platformPassword, 'PLATFORM');
  const supplierOwner = await login(supplierAccount, supplierPassword, 'SUPPLIER', { supplierId });
  report.supplierAccount = `member-${runId}@example.com`;
  report.supplierId = supplierId;
  await request('supplier/users', supplierOwner.accessToken, {
    name: `跨端验收业务成员 ${runId}`, email: report.supplierAccount, status: 'active', initialPassword: password,
  });
  const supplier = await login(report.supplierAccount, password, 'SUPPLIER', { supplierId });
  const s = supplier.accessToken;
  assert.ok(!(await request('auth/permissions', s)).permissions.includes('supplier:*'));
  await request('platform/tenants', platform.accessToken, {
    tenantId: runId, enterpriseId: `ent-${runId}`, name: `跨端采购验收 ${runId}`, industry: '信息技术',
    plan: 'MVP', userLimit: 10, enabledFeatures: ['rfq', 'finance', 'order', 'method:compare'],
    adminName: '跨端验收采购负责人', adminEmail: `${runId}@example.com`, adminPassword: password,
  });
  report.buyerAccount = `${runId}@example.com`;
  const buyer = await login(report.buyerAccount, password, 'BUYER', { tenantId: runId });
  const b = buyer.accessToken;
  check('independent tenant and buyer/supplier login');
  const department = await request('buyer/departments', b, { name: '验收采购部' });
  const material = await request('buyer/materials', b, {
    code: `MAT-${runId}`, name: '跨端验收办公设备', category: '通用采购', unit: '台', referencePrice: 400,
  });
  const role = (await request('buyer/roles', b)).find(r => r.permissions.includes('buyer:*'));
  assert.ok(role, 'Tenant owner role must exist');
  for (const businessType of ['buyer_supplier_admission', 'purchase_demand', 'rfq_award', 'payment_request', 'payment_batch']) {
    const definition = await request('buyer/process-definitions', b, { name: `验收 ${businessType}`, businessType, icon: 'file-text' });
    await request(`buyer/process-definitions/${definition.id}`, b, {
      name: definition.name, businessType, status: 'draft', formSchema: '{"fields":[]}',
      flowSchema: JSON.stringify({ steps: [{ id: 'review', type: 'approver', title: '验收审批', assignment: { type: 'role', roleId: role.id } }] }),
    }, 'PUT');
    assert.ok((await request(`buyer/process-definitions/${definition.id}/publish`, b, {})).activeVersionId);
  }
  check('five workflow definitions published in new tenant only');
  const relation = await request('buyer/suppliers', b, { supplierId, status: '待准入', level: '普通', categories: ['通用采购'] });
  await request(`buyer/suppliers/${relation.id}/submit`, b, { formData: {} });
  await complete(b, 'buyer_supplier_admission', relation.id);
  assert.equal((await request('buyer/suppliers', b)).find(r => r.id === relation.id).status, '已准入');
  const demand = await request('buyer/demands', b, {
    title: `跨端闭环采购 ${runId}`, departmentId: department.id, budget: 1200,
    lineItems: [{ materialId: material.id, quantity: 3 }], purpose: '隔离环境真实接口验收',
  });
  report.records.demandId = demand.id;
  await request(`buyer/demands/${demand.id}/submit`, b, { formData: {} });
  await complete(b, 'purchase_demand', demand.id);
  assert.equal((await request('buyer/demands', b)).find(d => d.id === demand.id).status, '已通过');
  const rfq = await request('buyer/rfqs', b, {
    title: `跨端闭环询价 ${runId}`, demandIds: [demand.id], invitedSupplierIds: [supplierId], deadlineAt: day(7),
  });
  report.records.rfqId = rfq.id;
  assert.ok((await request('supplier/rfqs', s)).some(r => r.id === rfq.id));
  const quote = await request(`supplier/rfqs/${rfq.id}/quotes`, s, {
    amount: 1200, taxRate: 13, deliveryDays: 3,
    lineItems: demand.lineItems.map(line => ({ demandItemId: line.id, description: material.name, unit: '台', quantity: 3, unitPrice: 400 })),
  });
  assert.equal((await request(`buyer/rfqs/${rfq.id}/open`, b, { force: true })).status, '已开标');
  const award = await request(`buyer/rfqs/${rfq.id}/award`, b, { quoteId: quote.id, reason: '隔离验收报价符合要求', formData: {} });
  report.records.awardId = award.id;
  await request('buyer/orders', b, { awardId: award.id, expectedReceiptDate: day(14).slice(0, 10) }, 'POST', [400]);
  check('order creation blocked before award approval');
  await complete(b, 'rfq_award', award.id);
  const order = await request('buyer/orders', b, { awardId: award.id, expectedReceiptDate: day(14).slice(0, 10) });
  report.records.orderId = order.id;
  assert.equal(order.amount, 1200);
  assert.ok((await request('supplier/orders', s)).some(o => o.id === order.id && o.amount === 1200));
  assert.equal((await request('buyer/orders', b, { awardId: award.id })).id, order.id);
  assert.equal((await request(`supplier/orders/${order.id}/confirm`, s, {})).status, '待发货');
  await request(`supplier/orders/${order.id}/deliveries`, s, { carrier: '验收物流', trackingNo: runId, shippedQuantity: 0 }, 'POST', [400]);
  assert.equal((await request('supplier/orders', s)).find(o => o.id === order.id).status, '待发货');
  await request(`supplier/orders/${order.id}/deliveries`, s, { carrier: '验收物流', trackingNo: runId, shippedQuantity: 3 });
  assert.equal((await request('buyer/orders', b)).find(o => o.id === order.id).status, '已发货');
  await request(`buyer/orders/${order.id}/receipts`, b, { result: '验收通过', receivedQuantity: 3, qualifiedQuantity: 3 });
  assert.equal((await request('supplier/orders', s)).find(o => o.id === order.id).status, '已收货');
  check('quote, award, unique order, confirmation, shipment and receipt synchronized');
  await request(`supplier/orders/${order.id}/invoices`, s, { amount: 1200, invoiceNo: `INV-${runId}`, taxRate: -1 }, 'POST', [400]);
  const invoice = await request(`supplier/orders/${order.id}/invoices`, s, { amount: 1200, invoiceNo: `INV-${runId}`, taxRate: 0 });
  assert.equal(invoice.taxRate, 0);
  check('invalid shipment quantity and tax rejected; explicit zero tax preserved');
  report.records.invoiceId = invoice.id;
  const match = (await request(`buyer/three-way-matches?invoiceId=${invoice.id}`, b)).find(m => m.invoiceId === invoice.id);
  assert.equal(match?.matchStatus, '三单匹配通过');
  assert.equal(match?.paymentReadiness, '可申请付款');
  const batchNo = `PAY-${runId}`;
  report.records.paymentBatchNo = batchNo;
  const payment = await request('buyer/payment-requests', b, { invoiceId: invoice.id, requestStatus: '付款申请待提交', paymentBatchNo: batchNo, remark: '仅登记付款，不触发真实资金划转' });
  await request(`buyer/payment-requests/${payment.id}/status`, b, { requestStatus: '付款申请审批中', formData: {} }, 'PUT');
  await complete(b, 'payment_request', payment.id);
  const execution = (await request(`buyer/payment-execution-records?paymentBatchNo=${batchNo}`, b)).find(e => e.invoiceId === invoice.id);
  assert.ok(execution, 'Payment execution record exists');
  await request(`buyer/payment-execution-records/${execution.id}/registration`, b, { paymentStatus: '已付款' }, 'POST', [400]);
  check('payment blocked before batch approval');
  await request(`buyer/payment-batches/${batchNo}/status`, b, { batchStatus: '审批中', formData: {} }, 'PUT');
  await complete(b, 'payment_batch', batchNo);
  await request(`buyer/payment-execution-records/${execution.id}/registration`, b,
    { paymentStatus: '已付款', releaseEvidenceNo: `QA-${runId}`, releaseRemark: '本地验收登记，无真实银行划款' });
  await request(`buyer/payment-execution-records/${execution.id}/registration`, b, { paymentStatus: '已付款' }, 'POST', [400]);
  for (const [scope, token] of [['buyer', b], ['supplier', s]]) {
    assert.equal((await request(`${scope}/invoices`, token)).find(i => i.id === invoice.id).paymentStatus, '已付款');
  }
  assert.equal((await request(`buyer/payment-batches/${batchNo}/status`, b, { batchStatus: '已付款归档' }, 'PUT')).batchStatus, '已付款归档');
  assert.equal((await request('buyer/workflow/tasks', b)).length, 0);
  check('three-way match, request/batch approval, payment registration and archive synchronized');
  const audit = await request('buyer/audit-logs', b);
  for (const targetId of [demand.id, rfq.id, order.id, invoice.id]) {
    assert.ok(audit.some(entry => entry.targetId === targetId && entry.actorId && entry.createdAt), `Missing audit trail: ${targetId}`);
  }
  assert.ok(audit.some(entry => entry.targetId === order.id && entry.actorId === supplier.userId), 'Supplier operations retain the actual member identity');
  check('business audit trail retains buyer and actual supplier member identities');
  report.passed = true;
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.error = error.message;
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  if (process.env.ACCEPTANCE_REPORT_PATH) writeFileSync(process.env.ACCEPTANCE_REPORT_PATH, JSON.stringify(report, null, 2));
}
