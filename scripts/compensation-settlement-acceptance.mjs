import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';

assert.equal(process.env.ACCEPTANCE_LOCAL_WRITES, '1');
assert.ok(process.env.ACCEPTANCE_PASSWORD);
const base = process.env.JAVA_API_BASE_URL || 'http://127.0.0.1:8097';
const preview = process.env.ACCEPTANCE_BROWSER_URL || 'http://127.0.0.1:5201';
assert.equal(
  new URL(base).origin,
  'http://127.0.0.1:8097',
  'Never write to original services',
);
assert.equal(new URL(preview).origin, 'http://127.0.0.1:5201');
const fixture = JSON.parse(
  readFileSync(
    process.env.COMPENSATION_FIXTURE || '.tmp/compensation-http.json',
  ),
);
assert.ok(fixture.passed && fixture.records.fundingUi);
const c = fixture.records.fundingUi,
  root = '/tmp/compensation-clearing-' + Date.now();
mkdirSync(root, { mode: 0o700 });
const report = {
  passed: false,
  root,
  tenantId: fixture.tenantId,
  projectId: c.projectId,
  orderId: c.orderId,
  checks: [],
  screenshots: [],
  errors: [],
};
async function api(
  path,
  token,
  body,
  method = body ? 'POST' : 'GET',
  expected = [200, 201],
) {
  const response = await fetch(base + '/api/v1/' + path, {
    method,
    signal: AbortSignal.timeout(45000),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  assert.ok(
    expected.includes(response.status),
    path + ': ' + response.status + ' ' + value.message,
  );
  return value.data;
}
const login = (account, scope) =>
  api('auth/login', null, {
    account,
    password: process.env.ACCEPTANCE_PASSWORD,
    scope,
    ...(scope === 'SUPPLIER'
      ? { supplierId: 'ent-supplier-sunrise' }
      : { tenantId: fixture.tenantId }),
  });
const buyer = await login(fixture.account, 'BUYER'),
  reviewer = await login(fixture.reviewerAccount, 'BUYER'),
  supplier = await login('supplier.sales@example.com', 'SUPPLIER');
const b = buyer.accessToken,
  r = reviewer.accessToken,
  s = supplier.accessToken;
const ep = 'buyer/projects/' + c.projectId,
  path = 'buyer/orders/' + c.orderId + '/settlements',
  sp = 'supplier/orders/' + c.orderId + '/settlements';
async function decide(type, id) {
  const tasks = await api('buyer/workflow/tasks', r),
    task = tasks.find((t) => t.businessType === type && t.businessId === id);
  if (!task) {
    const history = await api(
      'buyer/workflow/instances/business/' +
        type +
        '/' +
        encodeURIComponent(id) +
        '/history',
      r,
    );
    assert.equal(
      history.status,
      'approved',
      'Only verified completed preparation may resume',
    );
    if (['funding_change', 'order_settlement'].includes(type))
      assert.notEqual(history.initiatorId, history.completedBy);
    return;
  }
  assert.ok(task, 'Independent approval task ' + type);
  if (['funding_change', 'order_settlement'].includes(type))
    assert.ok(
      !(await api('buyer/workflow/tasks', b)).some((t) => t.businessId === id),
      'No self approval',
    );
  await api('buyer/workflow/tasks/' + task.taskId + '/complete', r, {
    action: 'approve',
    comment: '核验逐项货款、补偿及资金依据',
  });
}
const act = (token, e, action, scope = path) =>
  api(scope + '/' + e.id + '/actions', token, {
    revision: e.revision,
    action,
    reason: '双方协议与实际凭证分别核验',
    formData: {},
  });
async function approve(e) {
  const supplierDetail = await api(sp + '/' + e.id, s);
  assert.deepEqual(supplierDetail.fundingEntries, []);
  assert.equal(JSON.parse(supplierDetail.record.snapshot).funding, undefined);
  e = await act(s, e, 'accept', sp);
  e = await act(b, e, 'submit');
  await decide('order_settlement', e.id);
  return (await api(path + '/' + e.id, b)).record;
}
async function attachment(text, label) {
  const metadata = {
    ownerType: 'order_settlement_document',
    ownerId: c.orderId,
    fileName: label + '.txt',
    visibility: 'buyer_internal',
  };
  const ticket = await api('buyer/attachments/upload-ticket', b, metadata);
  assert.ok(
    (
      await fetch(base + ticket.uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + b,
          'Content-Type': 'application/octet-stream',
        },
        body: Buffer.from(text),
      })
    ).ok,
  );
  return (
    await api('buyer/attachments', b, {
      ...metadata,
      storageKey: ticket.storageKey,
    })
  ).id;
}
const evidence = (e, kind, amount, source, file, key, lines, period) =>
  api(path + '/' + e.id + '/evidence', b, {
    requestKey: key,
    kind,
    amount,
    source,
    attachmentId: file,
    evidenceNo: key,
    remark: '隔离验收样本，不代表真实银行或税务操作',
    ...(lines ? { fundingLines: lines } : {}),
    ...(period ? { cashPeriod: period } : {}),
  });
async function archive(label) {
  const a = await api('buyer/rfqs/' + c.rfqId + '/execution/archives', b, {
    remark: label,
  });
  return { id: a.id, bytes: await download(a.id, label + '.zip') };
}
async function download(id, filename) {
  const response = await fetch(
    base +
      '/api/v1/buyer/rfqs/' +
      c.rfqId +
      '/execution/archives/' +
      id +
      '/download',
    { headers: { Authorization: 'Bearer ' + b } },
  );
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  writeFileSync(root + '/' + filename, bytes);
  return bytes;
}
const browser = await chromium.launch(),
  contexts = [];
async function open(width) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 1000 },
    serviceWorkers: 'block',
  });
  contexts.push(context);
  await context.addInitScript(
    ({ buyer, tenantId }) =>
      localStorage.setItem(
        '24bid.tenant-portal.session',
        JSON.stringify({
          token: buyer.accessToken,
          userId: buyer.userId,
          displayName: buyer.displayName,
          tenantId,
        }),
      ),
    { buyer, tenantId: fixture.tenantId },
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() === 'error') report.errors.push(e.text());
  });
  await page.goto(preview + '/?module=orders&recordId=' + c.orderId);
  return page;
}
async function shot(page, label) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    'Whole-page overflow',
  );
  const file = root + '/' + label + '.png';
  await page.screenshot({ path: file });
  report.screenshots.push(file);
}
try {
  const project = (await api(ep, b)).project;
  const resumingPreparation =
    process.env.COMPENSATION_RESUME_PREPARATION === '1';
  if (resumingPreparation) {
    const funding = await api(ep + '/funding', b);
    assert.deepEqual(
      funding.sources.map((x) => [x.fundId, x.allocatedAmount]).sort(),
      [
        [c.funds[0], 700],
        [c.funds[1], 500],
      ].sort(),
    );
    assert.ok(funding.sources.every((x) => x.paidAmount === 0));
  } else {
    const plan = await api('buyer/funding/changes', b, {
      requestKey: 'COMP-PLAN',
      kind: 'project_plan',
      projectId: c.projectId,
      revision: project.revision,
      amount: 1200,
      lines: [
        { fundId: c.funds[0], amount: 700 },
        { fundId: c.funds[1], amount: 500 },
      ],
      reason: '货款与补偿分项清算',
      formData: {},
    });
    await decide('funding_change', plan.id);
  }
  const batch = 'COMP-PAY-' + fixture.runId;
  const request = resumingPreparation
    ? (
        await api(
          'buyer/payment-requests?invoiceId=' + encodeURIComponent(c.invoiceId),
          b,
        )
      ).find((x) => x.paymentBatchNo === batch)
    : await api('buyer/payment-requests', b, {
        invoiceId: c.invoiceId,
        requestStatus: '付款申请待提交',
        paymentBatchNo: batch,
        remark: '原900元实付',
      });
  assert.ok(request, 'Prepared payment request must exist');
  if (!resumingPreparation) {
    await api(
      'buyer/payment-requests/' + request.id + '/status',
      b,
      { requestStatus: '付款申请审批中', formData: {} },
      'PUT',
    );
  }
  await decide('payment_request', request.id);
  await api(
    'buyer/payment-batches/' + batch + '/status',
    b,
    { batchStatus: '审批中', formData: {} },
    'PUT',
  );
  await decide('payment_batch', batch);
  const ledgerPath = 'buyer/invoices/' + c.invoiceId + '/payment-ledger';
  await api(ledgerPath, b, {
    idempotencyKey: batch,
    amount: 900,
    evidenceNo: batch,
    fundingLines: [
      { fundId: c.funds[0], amount: 500 },
      { fundId: c.funds[1], amount: 400 },
    ],
  });
  const originalCash = (await api(ledgerPath, b)).entries;
  const targetPeriod = String(Number(project.period) + 1),
    future = [];
  for (const code of ['A', 'B']) {
    const fund = await api('buyer/funding', b, {
      departmentId: project.departmentId,
      period: targetPeriod,
      code,
      name: '当前补偿清算资金 ' + code,
    });
    const limit = await api('buyer/funding/changes', b, {
      requestKey: 'COMP-LIMIT-' + code,
      kind: 'fund_limit',
      fundId: fund.id,
      revision: fund.revision,
      amount: 1000,
      reason: '当前年度资金',
      formData: {},
    });
    await decide('funding_change', limit.id);
    future.push(fund.id);
  }
  const carry = await api(ep + '/lifecycle', b, {
    revision: (await api(ep, b)).project.revision,
    kind: 'carryover',
    targetPeriod,
    reason: '冻结历史900元现金，仅承接未付责任',
    formData: {},
    fundingSources: c.funds.map((id, i) => ({
      sourceFundId: id,
      targetFundId: future[i],
    })),
  });
  await decide('project_carryover', carry.id);
  const order = (await api('buyer/orders', b)).find((x) => x.id === c.orderId),
    line = order.lineItems[0].id;
  const firstFile = await attachment(
    '货款600元，补偿60元。退原货款300元，另付当年补偿60元。',
    '第一次清算协议',
  );
  const proposal = {
    requestKey: 'COMP-FIRST',
    compensation: 60,
    agreementId: firstFile,
    reason: '货款及补偿各自核验',
    prices: [{ lineId: line, unitPrice: 200 }],
    allocations: [{ source: c.invoiceId, goodsAmount: 600 }],
  };
  await api(
    path,
    b,
    { ...proposal, allocations: null },
    'POST',
    [400, 409, 422],
  );
  let first = await approve(await api(path, b, proposal));
  await evidence(
    first,
    'refund',
    300,
    c.invoiceId,
    firstFile,
    'FIRST-GOODS-REFUND',
    [
      { fundId: c.funds[0], amount: 200, targetFundId: future[0] },
      { fundId: c.funds[1], amount: 100, targetFundId: future[1] },
    ],
    project.period,
  );
  await evidence(
    first,
    'payment',
    60,
    '~compensation',
    firstFile,
    'FIRST-COMP-PAY',
    [{ fundId: future[0], amount: 60 }],
    targetPeriod,
  );
  await evidence(
    first,
    'invoice',
    600,
    c.invoiceId,
    firstFile,
    'FIRST-INVOICE',
  );
  await evidence(
    first,
    'compensation_receipt',
    60,
    '~compensation',
    firstFile,
    'FIRST-RECEIPT',
  );
  first = await act(b, first, 'complete');
  const prior = await api(path + '/' + first.id, b),
    oldArchive = await archive('首次660元清算归档');
  assert.equal(prior.netPaid, 660);

  const secondFile = await attachment(
    '新协议：货款600元不变，取消60元补偿，补偿款全额退回，取消凭据金额为0。',
    '取消补偿协议',
  );
  const page = await open(1440),
    panel = page.getByRole('region', {
      name: '合同解除与订单清算',
      exact: true,
    });
  await panel.getByRole('button', { name: '发起补充清算' }).click();
  await expect(panel.getByLabel('本次最终补偿款', { exact: true })).toHaveValue(
    '60',
  );
  await panel.getByLabel('本次最终补偿款', { exact: true }).fill('0');
  await panel.getByRole('spinbutton', { name: /清算单价/ }).fill('200');
  await panel.getByRole('spinbutton', { name: /清算货款/ }).fill('600');
  await panel
    .getByLabel('清算原因', { exact: true })
    .fill('新补充协议取消补偿，货款不变');
  await panel
    .getByRole('combobox', { name: /共享给供应商的清算协议/ })
    .selectOption(secondFile);
  await shot(page, 'cancel-compensation-proposal');
  await panel
    .getByRole('button', { name: '提交供应商确认', exact: true })
    .click();
  await expect(
    panel.getByRole('button', { name: '提交供应商确认', exact: true }),
  ).toHaveCount(0);
  let second = (await api(path, b)).items.find(
    (x) => x.status === 'supplier_pending',
  );
  assert.ok(second);
  second = await approve(second);
  assert.equal(second.initialPaid, 660);
  await page.reload();
  await panel
    .getByRole('row')
    .filter({ hasText: '待凭证清算' })
    .getByRole('button', { name: '详情', exact: true })
    .click();
  await panel
    .getByRole('combobox', { name: /^发票或款项归属/ })
    .selectOption('~compensation');
  await panel.getByRole('combobox', { name: /^类型/ }).selectOption('refund');
  await panel.getByLabel('金额', { exact: true }).fill('60');
  await panel
    .getByLabel('凭证编号', { exact: true })
    .fill('SECOND-COMP-REFUND');
  await panel.getByRole('combobox', { name: /^原件/ }).selectOption(secondFile);
  await panel
    .getByLabel('核对说明', { exact: true })
    .fill('实际60元补偿退款，不冲抵货款');
  await panel.getByLabel('清算来源金额 A', { exact: true }).fill('60');
  await shot(page, 'compensation-source-refund');
  await panel.getByRole('button', { name: '登记凭证', exact: true }).click();
  await expect(panel.getByLabel('凭证编号', { exact: true })).toHaveValue('');
  await evidence(
    second,
    'invoice',
    600,
    c.invoiceId,
    secondFile,
    'SECOND-INVOICE',
  );
  await api(
    path + '/' + second.id + '/actions',
    b,
    {
      revision: second.revision,
      action: 'complete',
      reason: '缺少取消凭据不得完成',
      formData: {},
    },
    'POST',
    [400, 409, 422],
  );
  await evidence(
    second,
    'compensation_receipt',
    0,
    '~compensation',
    secondFile,
    'SECOND-CANCEL-RECEIPT',
  );
  second = await act(b, second, 'complete');
  const secondRecord = (await api(path + '/' + second.id, b)).record;

  const thirdFile = await attachment(
    '第三版：货款450元，补偿90元。分别退款150元及补偿支付90元，不按净额只退60元。',
    '货款补偿分别调整协议',
  );
  let third = await approve(
    await api(path, b, {
      requestKey: 'COMP-THIRD',
      previousSettlementId: second.id,
      compensation: 90,
      agreementId: thirdFile,
      reason: '货款退款与补偿补付分别留痕',
      prices: [{ lineId: line, unitPrice: 150 }],
      allocations: [{ source: c.invoiceId, goodsAmount: 450 }],
    }),
  );
  let detail = await api(path + '/' + third.id, b);
  assert.equal(detail.refundDue, 150);
  assert.equal(detail.paymentDue, 90);
  await evidence(
    third,
    'refund',
    150,
    c.invoiceId,
    thirdFile,
    'THIRD-GOODS-REFUND',
    [
      { fundId: c.funds[0], amount: 100, targetFundId: future[0] },
      { fundId: c.funds[1], amount: 50, targetFundId: future[1] },
    ],
    project.period,
  );
  await evidence(
    third,
    'payment',
    90,
    '~compensation',
    thirdFile,
    'THIRD-COMP-PAY',
    [{ fundId: future[0], amount: 90 }],
    targetPeriod,
  );
  await evidence(
    third,
    'invoice',
    450,
    c.invoiceId,
    thirdFile,
    'THIRD-INVOICE',
  );
  await evidence(
    third,
    'compensation_receipt',
    90,
    '~compensation',
    thirdFile,
    'THIRD-RECEIPT',
  );
  third = await act(b, third, 'complete');
  detail = await api(path + '/' + third.id, b);
  assert.equal(detail.netPaid, 540);
  assert.deepEqual(detail.blockers, []);
  assert.deepEqual((await api(path + '/' + first.id, b)).record, prior.record);
  assert.deepEqual((await api(path + '/' + second.id, b)).record, secondRecord);
  assert.deepEqual((await api(ledgerPath, b)).entries, originalCash);
  assert.deepEqual(
    await download(oldArchive.id, '首次归档补充后再次下载.zip'),
    oldArchive.bytes,
  );
  const execution = await api('buyer/rfqs/' + c.rfqId + '/execution', b);
  assert.equal(execution.orderAmount, 540);
  assert.ok(execution.canArchive, JSON.stringify(execution.blockers));
  const finalArchive = await archive('最终货款450及补偿90归档');
  for (const width of [1440, 390]) {
    const p = await open(width),
      region = p.getByRole('region', {
        name: '合同解除与订单清算',
        exact: true,
      });
    await region
      .getByRole('button', { name: '详情', exact: true })
      .first()
      .click();
    await region
      .getByRole('region', { name: '清算来源分账明细', exact: true })
      .scrollIntoViewIfNeeded();
    await shot(p, 'final-' + width);
  }
  const funds = (await api('buyer/funding', b)).items;
  report.balances = [...c.funds, ...future].map((id) => {
    const fund = funds.find((x) => x.id === id);
    return { id, paid: fund.paidAmount };
  });
  assert.deepEqual(
    report.balances.map((x) => x.paid),
    [200, 250, 90, 0],
  );
  report.settlementIds = [first.id, second.id, third.id];
  report.archives = [oldArchive.id, finalArchive.id];
  report.finalNet = 540;
  report.checks.push(
    'Three independent supplier confirmations and workflow approvals',
    'UI defaults prior compensation60 and creates zero-compensation successor',
    'Zero cancellation proof required',
    'Historical goods refunds450 and current compensation net90 separately sourced',
    'Original900 cash, prior settlements and original ZIP unchanged',
    'Final540 counted once',
    'Desktop/mobile no overflow or runtime error',
  );
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.errors.push(error.stack);
  for (const [i, context] of contexts.entries())
    if (context.pages()[0])
      await context
        .pages()[0]
        .screenshot({ path: root + '/failure-' + i + '.png', fullPage: true });
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  writeFileSync(
    process.env.ACCEPTANCE_REPORT_PATH ||
      '.tmp/compensation-browser-result.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  if (!report.passed) process.exitCode = 1;
}
