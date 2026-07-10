// 写路径压测基线:按完整采购主链路创建数据,统计每条写路径的延迟与错误。
// 用法:node scripts/loadtest-write-paths.mjs [流程数=3] [并发=1] [baseURL=http://localhost:8080]
const TOTAL_FLOWS = Number(process.argv[2] || 3);
const CONCURRENCY = Number(process.argv[3] || 1);
const BASE = process.argv[4] || 'http://localhost:8080';

const WRITE_PATHS = [
  'create-demand',
  'approve-demand',
  'create-rfq',
  'submit-quote',
  'award-rfq',
  'create-order',
  'confirm-order',
  'submit-delivery',
  'register-receipt',
  'submit-invoice',
  'create-payment-request',
];

async function login({ scope, account, tenantId, supplierId }) {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account,
      password: 'demo123456',
      scope,
      tenantId,
      supplierId,
    }),
  });
  const body = await res.json();
  if (!body?.data?.accessToken) {
    throw new Error('登录失败:' + JSON.stringify(body));
  }
  return {
    tenantId: body.data.tenantId ?? tenantId,
    headers: { Authorization: `${body.data.tokenType ?? 'Bearer'} ${body.data.accessToken}` },
  };
}

async function requestJson(path, options, metrics, label) {
  const started = performance.now();
  const response = await fetch(`${BASE}${path}`, options);
  const text = await response.text();
  const elapsed = performance.now() - started;
  metrics.push({ label, elapsed, ok: response.ok });
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label} returned non-JSON ${response.status}: ${text.slice(0, 160)}`);
  }
  if (!response.ok) {
    throw new Error(`${label} failed ${response.status}: ${JSON.stringify(body)}`);
  }
  return body?.data ?? body;
}

function futureDate(days = 30) {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function futureDeadline(days = 14) {
  return `${futureDate(days)}T18:00:00+08:00`;
}

async function runFlow(flowNo, buyerHeaders, supplierHeaders, metrics) {
  const suffix = `${Date.now()}-${flowNo}`;
  const demand = await requestJson('/api/v1/buyer/demands', {
    method: 'POST',
    headers: { ...buyerHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      title: `写路径压测需求 ${suffix}`,
      departmentId: 'dept-it',
      budget: 120000,
      lineItems: [{ materialId: 'mat-laptop', quantity: 10 }],
      expectedDeliveryDate: futureDate(25),
      purchaseType: '常规',
      purpose: '写路径压测样本',
    }),
  }, metrics, 'create-demand');

  await requestJson(`/api/v1/buyer/demands/${demand.id}/submit`, {
    method: 'POST',
    headers: buyerHeaders,
  }, metrics, 'submit-demand');

  await requestJson(`/api/v1/buyer/demands/${demand.id}/approval`, {
    method: 'POST',
    headers: { ...buyerHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ approved: true }),
  }, metrics, 'approve-demand');

  const rfq = await requestJson('/api/v1/buyer/rfqs', {
    method: 'POST',
    headers: { ...buyerHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      title: `写路径压测 RFQ ${suffix}`,
      demandIds: [demand.id],
      invitedSupplierIds: ['ent-supplier-sunrise'],
      deadlineAt: futureDeadline(14),
    }),
  }, metrics, 'create-rfq');

  const quote = await requestJson(`/api/v1/supplier/rfqs/${rfq.id}/quotes`, {
    method: 'POST',
    headers: { ...supplierHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      amount: 118000,
      taxRate: 13,
      deliveryDays: 7,
    }),
  }, metrics, 'submit-quote');

  const award = await requestJson(`/api/v1/buyer/rfqs/${rfq.id}/award`, {
    method: 'POST',
    headers: { ...buyerHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      quoteId: quote.id,
      reason: '写路径压测报价最优',
    }),
  }, metrics, 'award-rfq');

  const approvedAward = await requestJson(`/api/v1/buyer/rfqs/${rfq.id}/award/approval`, {
    method: 'POST',
    headers: { ...buyerHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      awardId: award.id,
      approved: true,
    }),
  }, metrics, 'approve-award');

  const order = await requestJson('/api/v1/buyer/orders', {
    method: 'POST',
    headers: { ...buyerHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      awardId: approvedAward.id,
      expectedReceiptDate: futureDate(30),
    }),
  }, metrics, 'create-order');

  const confirmedOrder = await requestJson(`/api/v1/supplier/orders/${order.id}/confirm`, {
    method: 'POST',
    headers: supplierHeaders,
  }, metrics, 'confirm-order');

  await requestJson(`/api/v1/supplier/orders/${order.id}/deliveries`, {
    method: 'POST',
    headers: { ...supplierHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      carrier: '顺丰速运',
      trackingNo: `LOAD-${suffix}`,
    }),
  }, metrics, 'submit-delivery');

  await requestJson(`/api/v1/buyer/orders/${confirmedOrder.id}/receipts`, {
    method: 'POST',
    headers: { ...buyerHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ result: '验收通过' }),
  }, metrics, 'register-receipt');

  const invoice = await requestJson(`/api/v1/supplier/orders/${order.id}/invoices`, {
    method: 'POST',
    headers: { ...supplierHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      amount: order.amount,
      invoiceNo: `LOAD-INV-${suffix}`,
    }),
  }, metrics, 'submit-invoice');

  await requestJson('/api/v1/buyer/payment-requests', {
    method: 'POST',
    headers: { ...buyerHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({
      invoiceId: invoice.id,
      requestStatus: '付款申请待提交',
      paymentBatchNo: `LOAD-PAY-${suffix}`,
      remark: '写路径压测付款申请',
    }),
  }, metrics, 'create-payment-request');
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

function printSummary(metrics, started) {
  const elapsedSeconds = (performance.now() - started) / 1000;
  const errors = metrics.filter((m) => !m.ok).length;
  console.log('=== 24Bid 写路径压测基线 ===');
  console.log(`目标: ${BASE} · 流程 ${TOTAL_FLOWS} · 并发 ${CONCURRENCY} · 写路径 ${WRITE_PATHS.length} 类`);
  console.log(`总请求: ${metrics.length} · 吞吐: ${(metrics.length / elapsedSeconds).toFixed(1)} req/s · 错误 ${errors}`);
  for (const label of [...new Set(metrics.map((m) => m.label))]) {
    const values = metrics.filter((m) => m.label === label).map((m) => m.elapsed);
    const round = (n) => Math.round(n);
    console.log(
      `${label}: count=${values.length} p50=${round(percentile(values, 50))}ms `
      + `p95=${round(percentile(values, 95))}ms p99=${round(percentile(values, 99))}ms`,
    );
  }
}

async function main() {
  const buyer = await login({
    scope: 'BUYER',
    account: process.env.JAVA_BUYER_ACCOUNT ?? 'buyer.owner@example.com',
    tenantId: process.env.JAVA_TENANT_ID ?? 'tenant-acme',
  });
  const supplier = await login({
    scope: 'SUPPLIER',
    account: process.env.JAVA_SUPPLIER_ACCOUNT ?? 'supplier.sales@example.com',
    supplierId: process.env.JAVA_SUPPLIER_ID ?? 'ent-supplier-sunrise',
  });
  const metrics = [];
  let next = 0;
  const started = performance.now();

  async function worker() {
    while (next < TOTAL_FLOWS) {
      const flowNo = next++;
      await runFlow(flowNo, buyer.headers, supplier.headers, metrics);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  printSummary(metrics, started);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
