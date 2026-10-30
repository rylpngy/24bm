import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const root = process.env.ACCEPTANCE_BROWSER_DIR;
const base = process.env.JAVA_API_BASE_URL;
assert.ok(base && new URL(base).hostname === '127.0.0.1' && new URL(base).port !== '8080' && process.env.ACCEPTANCE_LOCAL_WRITES === '1');
const fixture = JSON.parse(readFileSync(`${root}/mall-stage-three-acceptance.json`));
assert.ok(fixture.passed);
const report = { passed: false, checks: [], records: {} };
async function api(path, token, body, method = body === undefined ? 'GET' : 'POST') {
  const r = await fetch(`${base}/api/v1/${path}`, { method, signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const value = await r.json();
  assert.ok(r.ok && value.success, `${path}: ${r.status} ${value.message}`);
  return value.data;
}
try {
  const b = (await api('auth/login', null, { account: fixture.buyerAccount, password: process.env.ACCEPTANCE_PASSWORD, scope: 'BUYER', tenantId: fixture.tenantId })).accessToken;
  const s = (await api('auth/login', null, { account: process.env.ACCEPTANCE_SUPPLIER_ACCOUNT, password: process.env.ACCEPTANCE_PASSWORD, scope: 'SUPPLIER', supplierId: process.env.ACCEPTANCE_SUPPLIER_ID })).accessToken;
  const role = (await api('buyer/roles', b)).find(r => r.permissions.includes('buyer:*'));
  for (const businessType of ['contract_approval', 'payment_request', 'payment_batch']) {
    const def = await api('buyer/process-definitions', b, { name: `商城闭环 ${businessType}`, businessType, icon: 'file-text' });
    await api(`buyer/process-definitions/${def.id}`, b, { name: def.name, businessType, status: 'draft', formSchema: '{"fields":[]}',
      flowSchema: JSON.stringify({ steps: [{ id: 'review', type: 'approver', title: '商城审批', assignment: { type: 'role', roleId: role.id } }] }) }, 'PUT');
    await api(`buyer/process-definitions/${def.id}/publish`, b, {});
  }
  async function approve(type, id) {
    const task = (await api('buyer/workflow/tasks', b)).find(t => t.businessType === type && t.businessId === id);
    assert.ok(task);
    assert.equal((await api(`buyer/workflow/tasks/${task.taskId}/complete`, b, { action: 'approve', comment: '隔离商城付款归档核验，无银行划款' })).status, 'approved');
  }
  const order = (await api('buyer/orders', b)).find(o => o.id === fixture.records.orderId);
  const contract = await api('buyer/contracts', b, { contractNo: `MALL-${Date.now()}`, contractName: '隔离商城履约合同', relatedOrderId: order.id,
    amount: order.amount, status: '草案', fulfillmentProgress: '待履约', paymentTerms: '验收合格后付款' });
  await api(`buyer/contracts/${contract.id}/approval`, b, { formData: {} });
  await approve('contract_approval', contract.id);
  const invoice = await api(`supplier/orders/${order.id}/invoices`, s, { amount: order.amount, invoiceNo: `MALL-INV-${Date.now()}`, taxRate: 13 });
  const match = (await api(`buyer/three-way-matches?invoiceId=${invoice.id}`, b)).find(m => m.invoiceId === invoice.id);
  assert.equal(match.matchStatus, '三单匹配通过');
  report.checks.push('mall contract approval and invoiced amount match original received order');
  const batch = `MALL-PAY-${Date.now()}`;
  const payment = await api('buyer/payment-requests', b, { invoiceId: invoice.id, requestStatus: '付款申请待提交', paymentBatchNo: batch, remark: '合成验收，无资金划转' });
  await api(`buyer/payment-requests/${payment.id}/status`, b, { requestStatus: '付款申请审批中', formData: {} }, 'PUT');
  await approve('payment_request', payment.id);
  await api(`buyer/payment-batches/${batch}/status`, b, { batchStatus: '审批中', formData: {} }, 'PUT');
  await approve('payment_batch', batch);
  const execution = (await api(`buyer/payment-execution-records?paymentBatchNo=${batch}`, b)).find(e => e.invoiceId === invoice.id);
  await api(`buyer/payment-execution-records/${execution.id}/registration`, b, { paymentStatus: '已付款', releaseEvidenceNo: `SYNTHETIC-${batch}`, releaseRemark: '仅隔离验收登记，非银行付款' });
  assert.equal((await api('supplier/invoices', s)).find(i => i.id === invoice.id).paymentStatus, '已付款');
  await api(`buyer/payment-batches/${batch}/status`, b, { batchStatus: '已付款归档' }, 'PUT');
  await api(`buyer/contracts/${contract.id}/archive-status`, b, { archiveStatus: '已归档' }, 'PUT');
  const progress = await api(`buyer/rfqs/${order.rfqId}/execution`, b);
  assert.equal(progress.canArchive, true, JSON.stringify(progress.blockers));
  const archive = await api(`buyer/rfqs/${order.rfqId}/execution/archives`, b, { remark: '商城合同、履约及付款登记闭环验收' });
  const download = await fetch(`${base}/api/v1/buyer/rfqs/${order.rfqId}/execution/archives/${archive.id}/download`, { headers: { Authorization: `Bearer ${b}` } });
  assert.ok(download.ok);
  const bytes = Buffer.from(await download.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  writeFileSync(`${root}/mall-finance-archive.zip`, bytes);
  report.records = { orderId: order.id, contractId: contract.id, invoiceId: invoice.id, archiveId: archive.id };
  report.checks.push('mall payment request/batch approval, registration, supplier state and real archive download');
  report.passed = true;
} catch (e) { report.error = e.message; process.exitCode = 1; }
finally { writeFileSync(`${root}/mall-finance-closeout.json`, JSON.stringify(report, null, 2)); }
