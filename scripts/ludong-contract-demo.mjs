import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Fixed isolated POC only. Resume checkpoints prevent duplicate demo business records.
assert.ok(process.argv.includes('--apply'), 'Explicit --apply required; writes synthetic POC business data.');
const base = 'http://127.0.0.1:8098/api/v1/';
const directory = resolve('.ludong-tender-runtime/contract-demo');
mkdirSync(directory, { recursive: true });
const file = resolve(directory, 'state.json');
const state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { run: `LDU-CONTRACT-${Date.now()}`, steps: {} };
const save = () => writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });
async function api(path, token, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(base + path, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(100000) });
  const value = await response.json();
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${value.message}`);
  return value.data;
}
async function step(name, action) {
  if (!(name in state.steps)) { state.steps[name] = (await action()) ?? null; save(); }
  console.log(`OK ${name}`);
  return state.steps[name];
}
const login = async (account, scope = 'BUYER', context = { tenantId: 'tenant-ludong-poc' }) =>
  api('auth/login', null, { account, password: 'demo123456', scope, ...context });
const session = await login('LDU000001');
assert.equal(session.tenantId, 'tenant-ludong-poc');
const admin = session.accessToken;
const suppliers = [];
for (const letter of ['a', 'b', 'c']) suppliers.push({ id: `ent-ldu-demo-${letter}`,
  token: (await login(`ldu.supplier.${letter}@example.com`, 'SUPPLIER', { supplierId: `ent-ldu-demo-${letter}` })).accessToken });
const future = (days) => new Date(Date.now() + days * 86400000).toISOString();
const paths = ['buyer/ludong-poc/applications', 'buyer/rfqs', 'buyer/orders', 'buyer/contracts', 'buyer/invoices', 'buyer/contract-review/documents?page=1&pageSize=50'];
await step('historical-snapshot', async () => Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await api(path, admin)]))));
const role = (await api('buyer/roles', admin)).find((r) => r.permissions.includes('buyer:*'));
assert.ok(role);
for (const businessType of ['rfq_award', 'contract_approval', 'payment_request', 'payment_batch']) {
  await step(`workflow:${businessType}`, async () => {
    const existing = (await api('buyer/process-definitions', admin)).find((d) => d.businessType === businessType && d.activeVersionId);
    if (existing) return existing;
    const definition = await step(`definition:${businessType}`, () => api('buyer/process-definitions', admin,
      { name: `合同演示-${businessType}`, businessType, icon: 'file-text' }));
    await api(`buyer/process-definitions/${definition.id}`, admin, { name: definition.name, businessType, status: 'draft',
      formSchema: '{"fields":[]}', flowSchema: JSON.stringify({ steps: [{ id: 'review', type: 'approver', title: '采购合同演示业务审核', assignment: { type: 'role', roleId: role.id } }] }) }, 'PUT');
    return api(`buyer/process-definitions/${definition.id}/publish`, admin, {});
  });
}
async function approve(type, id) {
  for (let count = 0; count < 20; count++) {
    const history = await api(`buyer/workflow/instances/business/${type}/${id}/history`, admin);
    if (history.status === 'approved') return history;
    const task = (await api('buyer/workflow/tasks', admin)).find((t) => t.businessType === type && t.businessId === id);
    assert.ok(task, `No eligible demo task ${type}/${id}; do not bypass authorization.`);
    await api(`buyer/workflow/tasks/${task.taskId}/complete`, admin, { action: 'approve', comment: '合同完整演示：人工复核通过，仅合成采购数据。' });
  }
  throw Error('Workflow exceeded expected demo steps');
}
const rfq = await step('rfq', () => api('buyer/rfqs', admin, {
  title: `采购合同全流程演示-${state.run}`, method: '询比', invitedSupplierIds: suppliers.map((s) => s.id),
  deadlineAt: future(7), saveAsDraft: true, quoteRequirement: '合成演示：按采购清单逐项含税报价，不构成真实采购邀约。',
  deliveryRequirement: '合同生效后30日内完成到货及安装。', evaluationMethod: '综合评审',
  directItems: [{ materialId: 'mat-ldu-teaching-terminal', quantity: 3 }, { materialId: 'mat-ldu-lab-instrument', quantity: 2 }],
  directDepartmentId: 'dept-ldu-physics', directBudget: 200000,
}));
await step('publish', () => api(`buyer/rfqs/${rfq.id}/publish`, admin, {}));
const items = (await api('supplier/rfqs', suppliers[0].token)).find((r) => r.id === rfq.id).items;
const quotes = [];
for (let index = 0; index < suppliers.length; index++) quotes.push(await step(`quote:${index}`, () => api(`supplier/rfqs/${rfq.id}/quotes`, suppliers[index].token,
  { amount: 178000 + index * 500, taxRate: 13, deliveryDays: 20 + index,
    lineItems: items.map((item) => ({ demandItemId: item.demandItemId, description: item.materialName, unit: item.unit, quantity: item.quantity,
      unitPrice: (item.materialId === 'mat-ldu-teaching-terminal' ? 6000 : 80000) + index * 100 })) })));
await step('open', () => api(`buyer/rfqs/${rfq.id}/open`, admin, { force: true }));
const award = await step('award', () => api(`buyer/rfqs/${rfq.id}/award`, admin,
  { quoteId: quotes[0].id, reason: '合成演示：三家报价完成比较，选定满足参数且综合评审最优的报价。', formData: {} }));
await step('award-approved', () => approve('rfq_award', award.id));
const order = await step('order', () => api('buyer/orders', admin, { awardId: award.id, expectedReceiptDate: future(14).slice(0, 10) }));
const amount = Number(order.amount);
const contract = await step('contract', () => api('buyer/contracts', admin, {
  contractNo: state.run, contractName: '鲁东大学教学终端与实验设备采购合同（全流程演示）', relatedOrderId: order.id,
  amount, status: '草案', fulfillmentProgress: '待同步', signDate: future(0).slice(0, 10), effectiveDate: future(0).slice(0, 10),
  expiryDate: future(365).slice(0, 10), paymentTerms: '预付30%，到货验收40%，质保30%；本套数据仅演示系统登记，不触发真实银行划款。',
  warrantyTerms: '质量保证期三年；维修响应及违约处理以双方正式约定为准。本合同为合成演示材料。',
}));
await step('contract-submit', () => api(`buyer/contracts/${contract.id}/approval`, admin, { formData: {} }));
await step('contract-approved', () => approve('contract_approval', contract.id));
await step('fulfillment-started', () => api(`buyer/contracts/${contract.id}/status`, admin, { status: '已生效', fulfillmentProgress: '同步中' }, 'PUT'));
const milestones = await step('schedule', () => api(`buyer/contracts/${contract.id}/payment-milestones/generate`, admin, {}));
for (const milestone of milestones.slice(0, 2)) await step(`reach:${milestone.id}`, () => api(`buyer/contracts/${contract.id}/payment-milestones/${milestone.id}/reach`, admin, {}));
await step('order-confirmed', () => api(`supplier/orders/${order.id}/confirm`, suppliers[0].token, {}));
const lines = order.lineItems;
assert.equal(lines.length, 2);
const quantity = lines.reduce((total, line) => total + Number(line.quantity), 0);
await step('delivery', () => api(`supplier/orders/${order.id}/deliveries`, suppliers[0].token, { carrier: '演示物流（非真实承运）', trackingNo: `${state.run}-DELIVERY`,
  shippedQuantity: quantity, lineItems: lines.map((line) => ({ orderLineId: line.id, shippedQuantity: Number(line.quantity) })) }));
await step('receipt', () => api(`buyer/orders/${order.id}/receipts`, admin, { result: '合成演示：设备数量、型号和安装调试核对通过。',
  receivedQuantity: quantity, qualifiedQuantity: quantity, lineItems: lines.map((line) => ({ orderLineId: line.id, receivedQuantity: Number(line.quantity), qualifiedQuantity: Number(line.quantity) })) }));
for (const [index, [actionType, summary]] of [
  ['收货', '合同关联订单已发货，采购方完成逐项收货。'], ['验收', '教学终端3台、实验数据采集仪2套，安装调试及参数验收通过。'],
  ['其他', '质保服务尚在执行，合同未归档，可继续展示履约协同。'],
].entries()) await step(`event:${index}`, () => api(`buyer/contracts/${contract.id}/fulfillment-events`, admin, { actionType, targetId: order.id, summary: `全流程演示：${summary}`, sourceLabel: 'POC业务联调' }));
await step('fulfillment', () => api(`buyer/contracts/${contract.id}/status`, admin, { status: '已生效', fulfillmentProgress: '已完成' }, 'PUT'));
await step('amendment', () => api(`buyer/contracts/${contract.id}/amendments`, admin, { changeType: '条款变更', reason: '演示补充约定：增加培训交接记录与设备使用指导，不改变合同金额、采购范围及付款口径。' }));
const invoice = await step('invoice', () => api(`supplier/orders/${order.id}/invoices`, suppliers[0].token, { amount, invoiceNo: `${state.run}-INV`, taxRate: 13 }));
const batch = `${state.run}-PAY`;
const payment = await step('payment-request', () => api('buyer/payment-requests', admin, { invoiceId: invoice.id,
  requestStatus: '付款申请待提交', paymentBatchNo: batch, remark: '仅合成演示付款申请，不触发真实银行付款。' }));
await step('payment-submit', () => api(`buyer/payment-requests/${payment.id}/status`, admin, { requestStatus: '付款申请审批中', formData: {} }, 'PUT'));
await step('payment-approved', () => approve('payment_request', payment.id));
await step('batch-submit', () => api(`buyer/payment-batches/${batch}/status`, admin, { batchStatus: '审批中', formData: {} }, 'PUT'));
await step('batch-approved', () => approve('payment_batch', batch));
await step('payment-ledger', () => api(`buyer/invoices/${invoice.id}/payment-ledger`, admin, {
  idempotencyKey: `${state.run}-30-percent`, amount: Math.round(amount * 30) / 100,
  evidenceNo: `${state.run}-SIMULATED`, remark: '合成演示登记30%首笔款，无真实银行转账。',
}));
await step('payment-event', () => api(`buyer/contracts/${contract.id}/fulfillment-events`, admin,
  { actionType: '付款', targetId: invoice.id, summary: '付款申请及批次已审批，台账登记30%，其余70%待后续付款；无真实资金划转。', sourceLabel: 'POC业务联调' }));

const prefix = 'buyer/contract-review';
const rules = [
  { id: 'prepay', title: '全额预付保障复核', type: 'KEYWORD', perspective: 'BUYER', severity: 'HIGH', matchMode: 'ALL', keywords: ['预付', '100%'],
    sourceName: '采购合同合成演示规则（非学校正式制度）', clause: '演示付款条款', basis: '核实预付款比例、付款前提及履约保障，结论由人工确认。', suggestion: '第二条 付款：预付30%，到货验收40%，质保30%；支付前须满足约定的发票及履约条件。' },
  { id: 'substitution', title: '单方替换产品责任复核', type: 'SEMANTIC', perspective: 'BOTH', severity: 'HIGH', matchMode: 'ANY', keywords: [],
    sourceName: '采购合同合成演示规则（非学校正式制度）', clause: '演示标的及变更条款', basis: '核实产品型号替换是否经采购方书面确认，复核履约责任，不作违法认定。', suggestion: '采购标的品牌型号变更须经双方书面确认，变更不得降低技术要求。' },
];
const set = await step('review-rules', () => api(`${prefix}/rule-sets`, admin, { name: `合同全流程演示规则-${state.run}`, expectedRevision: 0, rules }));
const version = await step('review-rule-version', () => api(`${prefix}/rule-sets/${set.id}/publish`, admin, { expectedRevision: 1 }));
const text = `采购合同待校对原稿（合成演示，非签署正本）\n合同编号：${contract.contractNo}\n关联订单：${order.id}\n第一条 标的：教学终端3台、实验数据采集仪2套，合同总额${amount}元。\n第二条 付款：甲方应预付100%合同款，不要求任何履约保障。\n第三条 乙方可以自行以任意型号替换全部设备，并不承担因此产生的责任。\n第四条 到货后由采购方验收，质量保证期三年。`;
const document = await step('review-document', async () => {
  const response = await fetch(base + `${prefix}/documents?fileName=${encodeURIComponent(`${contract.contractNo}-审查原稿.txt`)}&contractId=${contract.id}`,
    { method: 'POST', headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/octet-stream' }, body: Buffer.from(text) });
  const result = await response.json(); assert.ok(response.ok, result.message); return result.data;
});
const run = await step('model-review', () => api(`${prefix}/documents/${document.id}/reviews`, admin,
  { rulesVersionId: version.id, perspective: 'BUYER', expectedVersion: 1, useModel: true }));
const finding = run.findings.find((f) => f.ruleId === 'prepay'); assert.ok(finding);
await step('human-confirmation', () => api(`${prefix}/documents/${document.id}/reviews/${run.id}/decisions`, admin,
  { findingId: finding.id, action: 'adopt', expectedVersion: 1, replacement: finding.suggestion,
    comment: '演示人员人工复核：改为与合同台账一致的30%/40%/30%分期条件，仅形成校对稿，不自动覆盖正式合同。' }));
await step('seller-review', () => api(`${prefix}/documents/${document.id}/reviews`, admin,
  { rulesVersionId: version.id, perspective: 'SELLER', expectedVersion: 2, useModel: false }));
const currentRun = await step('model-review-current', () => api(`${prefix}/documents/${document.id}/reviews`, admin,
  { rulesVersionId: version.id, perspective: 'BUYER', expectedVersion: 2, useModel: true }));
await step('contract-attachment', async () => {
  const name = `${contract.contractNo}-演示合同说明.txt`;
  const ticket = await api('buyer/attachments/upload-ticket', admin, { ownerType: 'contract', ownerId: contract.id, fileName: name });
  const url = new URL(ticket.uploadUrl, base); assert.equal(url.origin, new URL(base).origin);
  const uploaded = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/octet-stream' }, body: Buffer.from(`合同编号：${contract.contractNo}\n关联订单：${order.id}\n合同金额：${amount}\n此材料仅供POC演示，不具备签署效力，不构成采购承诺。`) });
  assert.ok(uploaded.ok);
  return api('buyer/attachments', admin, { ownerType: 'contract', ownerId: contract.id, fileName: name, storageKey: ticket.storageKey });
});
const linked = await api(`${prefix}/documents?page=1&pageSize=10&contractId=${contract.id}`, admin);
assert.ok(linked.items.some((d) => d.id === document.id && d.contractId === contract.id));
assert.ok(linked.items.every((d) => d.contractId === contract.id), 'Contract filter must not expose unrelated review documents');
const denied = await fetch(base + `${prefix}/documents?contractId=contract-not-accessible`, { headers: { Authorization: `Bearer ${admin}` } });
assert.equal(denied.status, 403);
for (const [path, name] of [
  [`${prefix}/documents/${document.id}/versions/2/export`, '合同人工校对稿-V2.docx'],
  [`buyer/attachments/${state.steps['contract-attachment'].id}/download`, '合同演示说明.txt'],
]) {
  const response = await fetch(base + path, { headers: { Authorization: `Bearer ${admin}` } });
  assert.equal(response.status, 200); const bytes = Buffer.from(await response.arrayBuffer()); assert.ok(bytes.length);
  if (name.endsWith('.docx')) assert.equal(bytes.subarray(0,2).toString(), 'PK');
  writeFileSync(resolve(directory, name), bytes);
}
await step('revised-contract-attachment', async () => {
  const name = '采购合同人工校对稿-V2（演示，非签署正本）.docx';
  const ticket = await api('buyer/attachments/upload-ticket', admin, { ownerType: 'contract', ownerId: contract.id, fileName: name });
  const url = new URL(ticket.uploadUrl, base); assert.equal(url.origin, new URL(base).origin);
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/octet-stream' },
    body: readFileSync(resolve(directory, '合同人工校对稿-V2.docx')) });
  assert.ok(response.ok);
  return api('buyer/attachments', admin, { ownerType: 'contract', ownerId: contract.id, fileName: name, storageKey: ticket.storageKey });
});
const history = await api(`buyer/workflow/instances/business/contract_approval/${contract.id}/history`, admin);
assert.equal(history.status, 'approved'); assert.ok(history.events.length);
const ledger = await api(`buyer/invoices/${invoice.id}/payment-ledger`, admin);
assert.equal(Number(ledger.paidAmount), Math.round(amount * 30) / 100);
for (const path of paths) {
  const before = state.steps['historical-snapshot'][path];
  const after = await api(path, admin);
  const records = Array.isArray(before) ? before : before.items;
  const current = Array.isArray(after) ? after : after.items;
  for (const original of records) assert.deepEqual(current.find((r) => r.id === original.id), original, `Historical record changed: ${path}/${original.id}`);
}
const report = { passed: true, contractId: contract.id, contractNo: contract.contractNo, orderId: order.id, invoiceId: invoice.id,
  amount, paidAmount: ledger.paidAmount, remainingAmount: ledger.remainingAmount, reviewDocumentId: document.id,
  modelMode: currentRun.mode, model: currentRun.model, preservedHistoricalData: true,
  url: `http://127.0.0.1:5288/?solution=ludong-poc&module=contracts&recordId=${contract.id}`, completedAt: new Date().toISOString() };
writeFileSync(resolve(directory, 'result.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
