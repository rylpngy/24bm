import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.env.JAVA_API_BASE_URL;
assert.ok(base && ['127.0.0.1', 'localhost'].includes(new URL(base).hostname)
  && new URL(base).port !== '8080' && process.env.ACCEPTANCE_LOCAL_WRITES === '1',
  'Use an explicitly isolated local API, not the original 8080 service, and ACCEPTANCE_LOCAL_WRITES=1.');
const required = key => { assert.ok(process.env[key], `Missing ${key}`); return process.env[key]; };
const password = required('ACCEPTANCE_PASSWORD');
const supplierId = required('ACCEPTANCE_SUPPLIER_ID');
const runId = `phase2-${Date.now()}`;
const report = { runId, tenantId: runId, buyerAccount: `${runId}@example.com`, records: {}, checks: [], passed: false };
const future = days => new Date(Date.now() + days * 86400000).toISOString();
async function api(path, token, body, method = body === undefined ? 'GET' : 'POST', expected = [200, 201]) {
  const response = await fetch(`${base}/api/v1/${path}`, { method, signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`${method} ${path}: invalid JSON (${response.status}) ${text.slice(0, 300)}`); }
  assert.ok(expected.includes(response.status), `${method} ${path}: ${response.status} ${payload.message}`);
  assert.ok(text || !response.ok, `${method} ${path}: empty success response (${response.status})`);
  return payload.data;
}
const login = (account, scope, context = {}) => api('auth/login', null, { account, password, scope, ...context });
const check = name => { report.checks.push(name); console.log(`PASS ${name}`); };
async function decide(token, businessType, businessId, action = 'approve') {
  const task = (await api('buyer/workflow/tasks', token)).find(t => t.businessType === businessType && t.businessId === businessId);
  assert.ok(task, `Missing task ${businessType}/${businessId}`);
  return api(`buyer/workflow/tasks/${task.taskId}/complete`, token, { action, comment: `阶段二验收 ${action}` });
}
try {
  const platform = await login(required('ACCEPTANCE_PLATFORM_ACCOUNT'), 'PLATFORM');
  const supplier = await login(required('ACCEPTANCE_SUPPLIER_ACCOUNT'), 'SUPPLIER', { supplierId });
  const s = supplier.accessToken;
  await api('platform/tenants', platform.accessToken, { tenantId: runId, enterpriseId: `ent-${runId}`, name: `采购完整闭环 ${runId}`,
    industry: '通用采购', plan: 'MVP', userLimit: 20, enabledFeatures: ['rfq', 'finance', 'order', 'method:compare'],
    adminName: '采购负责人', adminEmail: report.buyerAccount, adminPassword: password });
  const buyer = await login(report.buyerAccount, 'BUYER', { tenantId: runId }); const b = buyer.accessToken;
  report.buyerId = buyer.userId;
  const departments = [];
  for (const name of ['采购部门A', '采购部门B']) departments.push(await api('buyer/departments', b, { name }));
  const year = new Date().getFullYear().toString();
  const material = await api('buyer/materials', b, { code: `MAT-${runId}`, name: '采购闭环设备', category: '通用采购', unit: '台', referencePrice: 400 });
  const role = (await api('buyer/roles', b)).find(r => r.permissions.includes('buyer:*')); assert.ok(role);
  const budgetReviewerAccount = `budget-review-${runId}@example.com`;
  await api('buyer/users', b, { name: '预算审批人', email: budgetReviewerAccount, status: 'active', departmentId: departments[0].id, roleId: role.id, initialPassword: password });
  const budgetReviewer = await login(budgetReviewerAccount, 'BUYER', { tenantId: runId });
  for (const businessType of ['buyer_supplier_admission', 'purchase_demand', 'rfq_award', 'contract_approval', 'payment_request', 'payment_batch', 'budget_change', 'budget_exception']) {
    const definition = await api('buyer/process-definitions', b, { name: `闭环审批 ${businessType}`, businessType, icon: 'file-text' });
    await api(`buyer/process-definitions/${definition.id}`, b, { name: definition.name, businessType, status: 'draft', formSchema: '{"fields":[]}',
      flowSchema: JSON.stringify({ steps: [{ id: 'review', type: 'approver', title: '业务审核', assignment: { type: 'role', roleId: role.id } }] }) }, 'PUT');
    await api(`buyer/process-definitions/${definition.id}/publish`, b, {});
  }
  const relation = await api('buyer/suppliers', b, { supplierId, status: '待准入', level: '普通', categories: ['通用采购'] });
  for (const d of departments) {
    const application = await api('buyer/budgets/requests', b, { departmentId: d.id, period: year, kind: 'initial', targetAmount: 10000, title: '年度采购预算', reason: '隔离验收的年度采购计划' });
    await api(`buyer/budgets/requests/${application.id}/submit`, b, { formData: {} });
    await decide(budgetReviewer.accessToken, 'budget_change', application.id);
  }
  check('department budgets require separate real reviewer approval before becoming effective');
  await api(`buyer/suppliers/${relation.id}/submit`, b, { formData: {} }); await decide(b, 'buyer_supplier_admission', relation.id);
  const body = (i, quantity, budget) => ({ title: `采购需求 ${runId}-${i}`, departmentId: departments[i].id, budget, purpose: '真实隔离验收', lineItems: [{ materialId: material.id, quantity }] });
  const firstDemandBudget = Number(process.env.ACCEPTANCE_FIRST_DEMAND_BUDGET ?? 1200);
  assert.ok(Number.isFinite(firstDemandBudget) && firstDemandBudget >= 1200);
  let demand1 = await api('buyer/demands', b, body(0, 3, firstDemandBudget));
  const attachmentBody = { ownerType: 'purchase_demand', ownerId: demand1.id, fileName: '采购论证材料.txt', visibility: 'buyer_internal' };
  const ticket = await api('buyer/attachments/upload-ticket', b, attachmentBody);
  const attachmentBytes = Buffer.from(`采购项目归档验收原件 ${runId}`, 'utf8');
  const uploaded = await fetch(`${base}${ticket.uploadUrl}`, { method: 'POST', headers: { Authorization: `Bearer ${b}`, 'Content-Type': 'application/octet-stream' }, body: attachmentBytes });
  assert.ok(uploaded.ok, `Attachment upload failed: ${uploaded.status}`);
  const attachment = await api('buyer/attachments', b, { ...attachmentBody, storageKey: ticket.storageKey });
  report.records.attachmentId = attachment.id;
  await api(`buyer/demands/${demand1.id}/submit`, b, { formData: {} });
  const rejected = await decide(b, 'purchase_demand', demand1.id, 'reject');
  demand1 = await api(`buyer/demands/${demand1.id}`, b, { ...body(0, 3, firstDemandBudget), purpose: '按意见补正' }, 'PUT');
  await api(`buyer/demands/${demand1.id}/submit`, b, { formData: {} });
  const resubmitted = await decide(b, 'purchase_demand', demand1.id); assert.notEqual(resubmitted.workflowInstanceId, rejected.workflowInstanceId);
  const demand2 = await api('buyer/demands', b, body(1, 2, 600));
  await api(`buyer/demands/${demand2.id}/submit`, b, { formData: {} });
  const firstInstance = await api(`buyer/workflow/instances/business/purchase_demand/${demand2.id}/history`, b);
  await api(`buyer/workflow/instances/${firstInstance.workflowInstanceId}/withdraw-purchase-demand`, b, { reason: '申报人修正后重提' });
  assert.equal((await api(`buyer/workflow/instances/${firstInstance.workflowInstanceId}/history`, b)).status, 'cancelled');
  await api(`buyer/demands/${demand2.id}/submit`, b, { formData: {} }); await decide(b, 'purchase_demand', demand2.id);
  check('demand rejection/edit/resubmission and initiator withdrawal retain separate workflow histories');
  const rfqBody = { title: `闭环采购 ${runId}`, demandIds: [demand1.id, demand2.id], invitedSupplierIds: [supplierId], deadlineAt: future(7), saveAsDraft: true };
  const abandoned = await api('buyer/rfqs', b, rfqBody);
  await api(`buyer/rfqs/${abandoned.id}/abort`, b, { kind: '废标', reason: '保留历史，取消草稿重新建项' });
  const rfq = await api('buyer/rfqs', b, rfqBody); report.records.rfqId = rfq.id;
  await api(`buyer/rfqs/${rfq.id}`, b, { title: rfq.title, deadlineAt: future(8), quoteRequirement: '逐行报价', deliveryRequirement: '分批履约' }, 'PUT');
  await api(`buyer/rfqs/${rfq.id}/publish`, b, {});
  const currentDemands = await api('buyer/demands', b);
  const demandLines = [demand1, demand2].map(d => currentDemands.find(x => x.id === d.id).lineItems[0]);
  const quote = await api(`supplier/rfqs/${rfq.id}/quotes`, s, { amount: 1800, taxRate: 13, deliveryDays: 3,
    lineItems: demandLines.map((l, i) => ({ demandItemId: l.id, description: material.name, unit: '台', quantity: i === 0 ? 3 : 2, unitPrice: i === 0 ? 400 : 300 })) });
  await api(`buyer/rfqs/${rfq.id}/open`, b, { force: true });
  const award = await api(`buyer/rfqs/${rfq.id}/award`, b, { quoteId: quote.id, reason: '符合采购要求', formData: {} }); await decide(b, 'rfq_award', award.id);
  const order = await api('buyer/orders', b, { awardId: award.id, expectedReceiptDate: future(14).slice(0, 10) });
  report.records.orderId = order.id;
  const contractBody = { contractNo: `CON-${runId}`, contractName: '采购履约合同', relatedOrderId: order.id, amount: 1800, status: '草案', fulfillmentProgress: '待履约', paymentTerms: '验收通过后付款' };
  await api('buyer/contracts', b, { ...contractBody, status: '已生效' }, 'POST', [400]);
  const contract = await api('buyer/contracts', b, contractBody); report.records.contractId = contract.id;
  await api(`buyer/contracts/${contract.id}/approval`, b, { formData: {} }); await decide(b, 'contract_approval', contract.id);
  await api(`buyer/contracts/${contract.id}`, b, { ...contractBody, status: '已生效', amount: 1 }, 'PUT', [400]);
  await api(`buyer/contracts/${contract.id}/archive-status`, b, { archiveStatus: '已归档' }, 'PUT', [400]);
  check('draft cancel releases demand; award and contract approval cannot be bypassed; premature archive blocked');
  await api(`supplier/orders/${order.id}/confirm`, s, {});
  const lines = order.lineItems; assert.equal(lines.length, 2);
  const firstBatch = lines.map(line => ({ orderLineId: line.id, shippedQuantity: 1 }));
  await api(`supplier/orders/${order.id}/deliveries`, s, { carrier: '验收物流', trackingNo: `${runId}-1`, shippedQuantity: 2, lineItems: firstBatch });
  await api(`buyer/orders/${order.id}/receipts`, b, { result: '第一批合格', receivedQuantity: 2, qualifiedQuantity: 2,
    lineItems: lines.map(line => ({ orderLineId: line.id, receivedQuantity: 1, qualifiedQuantity: 1 })) });
  assert.equal((await api('buyer/orders', b)).find(x => x.id === order.id).status, '已发货');
  await api(`supplier/orders/${order.id}/invoices`, s, { amount: 1800, invoiceNo: `EARLY-${runId}` }, 'POST', [400]);
  await api(`supplier/orders/${order.id}/deliveries`, s, { carrier: '验收物流', trackingNo: 'over', shippedQuantity: 10,
    lineItems: lines.map(line => ({ orderLineId: line.id, shippedQuantity: 5 })) }, 'POST', [400]);
  const remainder = lines.map(line => ({ orderLineId: line.id, shippedQuantity: Number(line.quantity) - 1 }));
  await api(`supplier/orders/${order.id}/deliveries`, s, { carrier: '验收物流', trackingNo: `${runId}-2`, shippedQuantity: 3, lineItems: remainder });
  await api(`buyer/orders/${order.id}/receipts`, b, { result: '第二批合格', receivedQuantity: 3, qualifiedQuantity: 3,
    lineItems: remainder.map(line => ({ orderLineId: line.orderLineId, receivedQuantity: line.shippedQuantity, qualifiedQuantity: line.shippedQuantity })) });
  assert.equal((await api('buyer/orders', b)).find(x => x.id === order.id).status, '已收货');
  check('two shipments/two receipts retain partial state and reject cumulative overshipment');
  const invoice = await api(`supplier/orders/${order.id}/invoices`, s, { amount: 1800, invoiceNo: `INV-${runId}`, taxRate: 0 }); report.records.invoiceId = invoice.id;
  const batchNo = `PAY-${runId}`;
  const payment = await api('buyer/payment-requests', b, { invoiceId: invoice.id, requestStatus: '付款申请待提交', paymentBatchNo: batchNo, remark: '无真实资金划转' });
  await api(`buyer/payment-requests/${payment.id}/status`, b, { requestStatus: '付款申请审批中', formData: {} }, 'PUT'); await decide(b, 'payment_request', payment.id);
  await api(`buyer/payment-batches/${batchNo}/status`, b, { batchStatus: '审批中', formData: {} }, 'PUT'); await decide(b, 'payment_batch', batchNo);
  const ledgerPath = `buyer/invoices/${invoice.id}/payment-ledger`;
  await api(ledgerPath, b, { idempotencyKey: `${runId}-part1`, amount: 600, evidenceNo: '验收凭据1' });
  assert.equal((await api(`buyer/rfqs/${rfq.id}/execution`, b)).canArchive, false);
  await api(`buyer/contracts/${contract.id}/archive-status`, b, { archiveStatus: '已归档' }, 'PUT', [400]);
  await api(ledgerPath, b, { idempotencyKey: `${runId}-over`, amount: 1201, evidenceNo: '超付测试' }, 'POST', [400]);
  await api(ledgerPath, b, { idempotencyKey: `${runId}-part2`, amount: 1200, evidenceNo: '验收凭据2' });
  const paid = await api(ledgerPath, b); assert.equal(paid.paidAmount, 1800); assert.equal(paid.remainingAmount, 0);
  await api(`buyer/contracts/${contract.id}/archive-status`, b, { archiveStatus: '已归档' }, 'PUT');
  const execution = await api(`buyer/rfqs/${rfq.id}/execution`, b); assert.equal(execution.canArchive, true, JSON.stringify(execution.blockers)); assert.equal(execution.paidAmount, 1800);
  const archive = await api(`buyer/rfqs/${rfq.id}/execution/archives`, b, { remark: '全流程单据及附件核对通过' }); report.records.archiveId = archive.id;
  const r = await fetch(`${base}/api/v1/buyer/rfqs/${rfq.id}/execution/archives/${archive.id}/download`, { headers: { Authorization: `Bearer ${b}` } });
  assert.equal(r.status, 200); const bytes = Buffer.from(await r.arrayBuffer()); assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  const output = process.env.ACCEPTANCE_DOWNLOAD_DIR ?? '/tmp/procurement-stage-two'; mkdirSync(output, { recursive: true }); writeFileSync(`${output}/project-archive.zip`, bytes);
  writeFileSync(`${output}/expected-original.txt`, attachmentBytes);
  check('partial payments, overpayment protection, contract closeout and real ZIP archive complete');
  const foreign = await login(required('ACCEPTANCE_FOREIGN_BUYER_ACCOUNT'), 'BUYER', { tenantId: required('ACCEPTANCE_FOREIGN_TENANT') });
  await api(`buyer/rfqs/${rfq.id}/execution`, foreign.accessToken, undefined, 'GET', [400, 403, 404]);
  await api(`buyer/rfqs/${rfq.id}/execution/archives/${archive.id}/download`, foreign.accessToken, undefined, 'GET', [400, 403, 404]);
  check('cross-tenant execution/archive rejected');
  const qualityDemand = await api('buyer/demands', b, { ...body(0, 1, 400), title: `验收异常 ${runId}` });
  await api(`buyer/demands/${qualityDemand.id}/submit`, b, { formData: {} }); await decide(b, 'purchase_demand', qualityDemand.id);
  const qualityRfq = await api('buyer/rfqs', b, { ...rfqBody, title: `质量复核 ${runId}`, demandIds: [qualityDemand.id], saveAsDraft: false });
  const qualityLine = (await api('buyer/demands', b)).find(x => x.id === qualityDemand.id).lineItems[0];
  const qualityQuote = await api(`supplier/rfqs/${qualityRfq.id}/quotes`, s, { amount: 400, taxRate: 13, deliveryDays: 1,
    lineItems: [{ demandItemId: qualityLine.id, description: material.name, unit: '台', quantity: 1, unitPrice: 400 }] });
  await api(`buyer/rfqs/${qualityRfq.id}/open`, b, { force: true });
  const qualityAward = await api(`buyer/rfqs/${qualityRfq.id}/award`, b, { quoteId: qualityQuote.id, reason: '准备质量复核场景', formData: {} }); await decide(b, 'rfq_award', qualityAward.id);
  const qualityOrder = await api('buyer/orders', b, { awardId: qualityAward.id, expectedReceiptDate: future(14).slice(0, 10) });
  await api(`supplier/orders/${qualityOrder.id}/confirm`, s, {});
  await api(`supplier/orders/${qualityOrder.id}/deliveries`, s, { carrier: '验收物流', trackingNo: `${runId}-quality`, shippedQuantity: 1,
    lineItems: qualityOrder.lineItems.map(l => ({ orderLineId: l.id, shippedQuantity: 1 })) });
  const qualityReceipt = await api(`buyer/orders/${qualityOrder.id}/receipts`, b, { result: '发现质量问题', receivedQuantity: 1, qualifiedQuantity: 0,
    disposition: '退货换货', dispositionNote: '保留原验收，等待授权复核', lineItems: qualityOrder.lineItems.map(l => ({ orderLineId: l.id, receivedQuantity: 1, qualifiedQuantity: 0 })) });
  const qualityInvoice = await api(`supplier/orders/${qualityOrder.id}/invoices`, s, { amount: 400, invoiceNo: `QUALITY-${runId}`, taxRate: 0 });
  const qualityMatch = (await api(`buyer/three-way-matches?invoiceId=${qualityInvoice.id}`, b)).find(x => x.invoiceId === qualityInvoice.id);
  assert.notEqual(qualityMatch?.matchStatus, '三单匹配通过');
  Object.assign(report.records, { qualityRfqId: qualityRfq.id, qualityOrderId: qualityOrder.id, qualityReceiptId: qualityReceipt.id, qualityInvoiceId: qualityInvoice.id });
  check('unresolved rejected receipt cannot pass amount-only matching; prepared for real UI disposition review');
  report.records.demandIds = [demand1.id, demand2.id]; report.records.batchNo = batchNo; report.downloadDirectory = output;
  report.budgets = await api('buyer/budgets', b);
  const allocatedFirst = Math.round(1800 * firstDemandBudget / (firstDemandBudget + 600) * 100) / 100;
  assert.equal(report.budgets.find(x => x.departmentId === departments[0].id).disbursed, allocatedFirst);
  assert.equal(report.budgets.find(x => x.departmentId === departments[1].id).disbursed, 1800 - allocatedFirst);
  report.budgetPositions = await api('buyer/budgets/positions', b);
  const release = report.budgetPositions.reduce((sum, row) => sum + row.releasedAmount, 0);
  assert.equal(Math.round(release * 100), Math.round((firstDemandBudget + 600 - 1800) * 100));
  check('real archived project releases unused demand reservation without deducting payment twice');
  check('cross-department net payment is allocated explicitly without omission or double counting');
  report.passed = true;
} catch (error) { report.error = error.message; process.exitCode = 1; }
finally { if (process.env.ACCEPTANCE_REPORT_PATH) writeFileSync(process.env.ACCEPTANCE_REPORT_PATH, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2)); }
