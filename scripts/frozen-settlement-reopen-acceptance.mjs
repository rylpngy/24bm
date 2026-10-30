import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium, expect as baseExpect } from '@playwright/test';
assert.equal(
  process.env.ACCEPTANCE_LOCAL_WRITES,
  '1',
  'Isolated acceptance writes must be explicit',
);
assert.ok(
  process.env.ACCEPTANCE_PASSWORD,
  'Provide isolated acceptance credentials',
);
const apiBase = process.env.JAVA_API_BASE_URL || 'http://127.0.0.1:8097',
  browserBase = process.env.ACCEPTANCE_BROWSER_URL || 'http://127.0.0.1:5201';
assert.equal(
  new URL(apiBase).origin,
  'http://127.0.0.1:8097',
  'Do not write to original services',
);
assert.equal(new URL(browserBase).origin, 'http://127.0.0.1:5201');
const expect = baseExpect.configure({ timeout: 30000 });
const f = JSON.parse(
    readFileSync(
      process.env.FROZEN_SETTLEMENT_FIXTURE || '.tmp/frozen-reopen-http.json',
    ),
  ),
  c = f.records.fundingUi;
assert.ok(f.passed && c);
const root = '/tmp/frozen-reopen-browser-' + Date.now();
mkdirSync(root, { mode: 0o700 });
const result = {
  passed: false,
  root,
  screenshots: [],
  errors: [],
  checks: [],
  projectId: c.projectId,
  invoiceId: c.invoiceId,
};
async function api(
  path,
  token,
  body,
  method = body ? 'POST' : 'GET',
  expected = [200, 201],
) {
  const response = await fetch(apiBase + '/api/v1/' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.ok(
    expected.includes(response.status),
    path + ': ' + response.status + ' ' + data.message,
  );
  return data.data;
}
const login = (account, scope) =>
  api('auth/login', null, {
    account,
    password: process.env.ACCEPTANCE_PASSWORD,
    scope,
    ...(scope === 'SUPPLIER'
      ? { supplierId: 'ent-supplier-sunrise' }
      : { tenantId: f.tenantId }),
  });
const buyer = await login(f.account, 'BUYER'),
  reviewer = await login(f.reviewerAccount, 'BUYER'),
  supplier = await login('supplier.sales@example.com', 'SUPPLIER');
const b = buyer.accessToken,
  r = reviewer.accessToken,
  s = supplier.accessToken;
async function decide(type, id) {
  const task = (await api('buyer/workflow/tasks', r)).find(
    (t) => t.businessType === type && t.businessId === id,
  );
  assert.ok(task, 'Independent task ' + type);
  if (
    ['funding_change', 'order_settlement', 'project_liquidation'].includes(type)
  )
    assert.ok(
      !(await api('buyer/workflow/tasks', b)).some((t) => t.businessId === id),
      'No self approval',
    );
  await api('buyer/workflow/tasks/' + task.taskId + '/complete', r, {
    action: 'approve',
    comment: '核验原付款和逐票专项资金归属',
  });
}
const browser = await chromium.launch(),
  contexts = [];
async function open(width) {
  const ctx = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 1000 },
    serviceWorkers: 'block',
  });
  contexts.push(ctx);
  await ctx.addInitScript(
    ({ s, f }) =>
      localStorage.setItem(
        '24bid.tenant-portal.session',
        JSON.stringify({
          token: s.accessToken,
          userId: s.userId,
          displayName: s.displayName,
          tenantId: f.tenantId,
        }),
      ),
    { s: buyer, f },
  );
  const p = await ctx.newPage();
  p.on('pageerror', (e) => result.errors.push(e.message));
  p.on('console', (e) => {
    if (e.type() === 'error') result.errors.push(e.text());
  });
  await p.goto(browserBase + '/?module=orders&recordId=' + c.orderId);
  return p;
}
async function shot(p, label) {
  assert.ok(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    'Whole-page overflow',
  );
  const file = root + '/' + label + '.png';
  await p.screenshot({ path: file });
  result.screenshots.push(file);
}
try {
  const ep = 'buyer/projects/' + c.projectId,
    invoice = 'buyer/invoices/' + c.invoiceId + '/payment-ledger',
    project = (await api(ep, b)).project;
  const plan = await api('buyer/funding/changes', b, {
    requestKey: 'PLAN-' + f.runId,
    kind: 'project_plan',
    projectId: c.projectId,
    revision: project.revision,
    amount: 1200,
    lines: [
      { fundId: c.funds[0], amount: 700 },
      { fundId: c.funds[1], amount: 500 },
    ],
    reason: '逐票专项清算核验',
    formData: {},
  });
  await decide('funding_change', plan.id);
  const batch = 'LIQ-' + f.runId,
    pay = await api('buyer/payment-requests', b, {
      invoiceId: c.invoiceId,
      requestStatus: '付款申请待提交',
      paymentBatchNo: batch,
      remark: '原实际付款及归属',
    });
  await api(
    'buyer/payment-requests/' + pay.id + '/status',
    b,
    { requestStatus: '付款申请审批中', formData: {} },
    'PUT',
  );
  await decide('payment_request', pay.id);
  await api(
    'buyer/payment-batches/' + batch + '/status',
    b,
    { batchStatus: '审批中', formData: {} },
    'PUT',
  );
  await decide('payment_batch', batch);
  await api(invoice, b, {
    idempotencyKey: 'ORIGINAL-' + f.runId,
    amount: 900,
    evidenceNo: 'BANK-ORIGINAL-' + f.runId,
    fundingLines: [
      { fundId: c.funds[0], amount: 500 },
      { fundId: c.funds[1], amount: 400 },
    ],
  });
  const original = (await api(invoice, b)).entries[0];
  result.originalEntryId = original.id;

  const targetPeriod = String(Number(project.period) + 1),
    future = [];
  for (const code of ['A', 'B']) {
    const fund = await api('buyer/funding', b, {
      departmentId: project.departmentId,
      period: targetPeriod,
      code,
      name: '承接资金 ' + code,
    });
    const limit = await api('buyer/funding/changes', b, {
      requestKey: 'TARGET-' + code + '-' + f.runId,
      kind: 'fund_limit',
      fundId: fund.id,
      revision: fund.revision,
      amount: 1000,
      reason: '承接资金年度额度',
      formData: {},
    });
    await decide('funding_change', limit.id);
    future.push(fund.id);
  }
  const carried = await api(ep + '/lifecycle', b, {
    revision: (await api(ep, b)).project.revision,
    kind: 'carryover',
    targetPeriod,
    reason: '冻结历史实际付款，仅承接未付责任',
    formData: {},
    fundingSources: c.funds.map((id, i) => ({
      sourceFundId: id,
      targetFundId: future[i],
    })),
  });
  await decide('project_carryover', carried.id);
  result.carryId = carried.id;
  result.targetPeriod = targetPeriod;
  result.future = future;
  const attachmentBody = {
    ownerType: 'order_settlement_document',
    ownerId: c.orderId,
    fileName: '清算协议与银行回单-' + f.runId + '.txt',
    visibility: 'buyer_internal',
  };
  const ticket = await api(
      'buyer/attachments/upload-ticket',
      b,
      attachmentBody,
    ),
    bytes = Buffer.from(
      '双方一致确认结算货款600元，退还原款300元。原A500/B400，退款A200/B100。' +
        f.runId,
    );
  assert.ok(
    (
      await fetch(apiBase + ticket.uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + b,
          'Content-Type': 'application/octet-stream',
        },
        body: bytes,
      })
    ).ok,
  );
  const attachment = await api('buyer/attachments', b, {
    ...attachmentBody,
    storageKey: ticket.storageKey,
  });
  const path = 'buyer/orders/' + c.orderId + '/settlements',
    sp = 'supplier/orders/' + c.orderId + '/settlements';
  const order = (await api('buyer/orders', b)).find((x) => x.id === c.orderId);
  const proposal = {
    requestKey: 'SET-' + f.runId,
    reason: '原单不变，按已履行数量和降价协议清算',
    compensation: 0,
    agreementId: attachment.id,
    prices: [{ lineId: order.lineItems[0].id, unitPrice: 200 }],
    allocations: [{ source: c.invoiceId, goodsAmount: 600 }],
  };
  await api(
    path,
    b,
    { ...proposal, allocations: null },
    'POST',
    [400, 409, 422],
  );
  let entry = await api(path, b, proposal);
  result.settlementId = entry.id;
  const act = (token, action, e, scope = path) =>
    api(scope + '/' + e.id + '/actions', token, {
      revision: e.revision,
      action,
      reason: '核对双方协议、实物及原件',
      formData: {},
    });
  const sd = await api(sp + '/' + entry.id, s);
  assert.equal(JSON.parse(sd.record.snapshot).funding, undefined);
  assert.deepEqual(sd.fundingEntries, []);
  entry = await act(s, 'accept', entry, sp);
  entry = await act(b, 'submit', entry);
  await decide('order_settlement', entry.id);
  entry = (await api(path + '/' + entry.id, b)).record;
  await api(
    invoice,
    b,
    {
      idempotencyKey: 'WRONG-' + f.runId,
      amount: 1,
      evidenceNo: 'WRONG-' + f.runId,
      fundingLines: [{ fundId: c.funds[0], amount: 1 }],
    },
    'POST',
    [400, 409, 422],
  );
  const p = await open(1440),
    panel = p.getByRole('region', { name: '合同解除与订单清算', exact: true });
  await panel
    .getByRole('button', { name: '详情', exact: true })
    .first()
    .click();
  await panel
    .getByRole('combobox', { name: /^发票或款项归属/ })
    .selectOption(c.invoiceId);
  await panel.getByRole('combobox', { name: /^类型/ }).selectOption('refund');
  await panel.getByLabel('金额', { exact: true }).fill('300');
  await panel.getByLabel('凭证编号', { exact: true }).fill('REFUND-' + f.runId);
  await panel
    .getByRole('combobox', { name: /^原件/ })
    .selectOption(attachment.id);
  await panel
    .getByLabel('核对说明', { exact: true })
    .fill('历史银行退款，当前年度责任显式回补');
  await expect(
    panel.getByRole('button', { name: '登记凭证', exact: true }),
  ).toBeDisabled();
  await panel
    .getByLabel('退款归属年度', { exact: true })
    .selectOption(project.period);
  await panel.getByLabel('清算来源金额 A', { exact: true }).fill('200');
  await panel.getByLabel('清算来源金额 B', { exact: true }).fill('100');
  await expect(
    panel.getByRole('button', { name: '登记凭证', exact: true }),
  ).toBeDisabled();
  await panel.getByLabel('回补来源 A', { exact: true }).selectOption(future[0]);
  await panel.getByLabel('回补来源 B', { exact: true }).selectOption(future[1]);
  await expect(
    panel.getByRole('button', { name: '登记凭证', exact: true }),
  ).toBeEnabled();
  await panel
    .getByRole('region', { name: '清算资金来源', exact: true })
    .scrollIntoViewIfNeeded();
  await shot(p, 'historical-refund-restoration');
  await panel.getByRole('button', { name: '登记凭证', exact: true }).click();
  await expect(panel.getByLabel('凭证编号', { exact: true })).toHaveValue('');
  let detail = await api(path + '/' + entry.id, b);
  assert.equal(detail.netPaid, 600);
  assert.ok(
    detail.fundingEntries.every((x) => future.includes(x.targetFundId)),
  );
  await panel.getByRole('combobox', { name: /^类型/ }).selectOption('invoice');
  await panel.getByLabel('金额', { exact: true }).fill('600');
  await panel
    .getByLabel('凭证编号', { exact: true })
    .fill('INV-FIRST-' + f.runId);
  await panel
    .getByLabel('核对说明', { exact: true })
    .fill('600元最终发票及红冲核对');
  await panel.getByRole('button', { name: '登记凭证', exact: true }).click();
  await expect(panel.getByLabel('凭证编号', { exact: true })).toHaveValue('');
  await panel
    .getByRole('button', { name: '完成清算并归档合同', exact: true })
    .click();
  await expect(
    panel.getByText('清算完成', { exact: true }).first(),
  ).toBeVisible();
  const originalSettlement = (await api(path + '/' + entry.id, b)).record;
  result.firstSettlementId = entry.id;
  const oldArchive = await api(
    'buyer/rfqs/' + c.rfqId + '/execution/archives',
    b,
    { remark: '第一次清算已完成，冻结原执行档案' },
  );
  result.oldArchiveId = oldArchive.id;
  const download = async (id, name) => {
    const r = await fetch(
      'http://127.0.0.1:8097/api/v1/buyer/rfqs/' +
        c.rfqId +
        '/execution/archives/' +
        id +
        '/download',
      { headers: { Authorization: 'Bearer ' + b } },
    );
    assert.equal(r.status, 200);
    const bytes = Buffer.from(await r.arrayBuffer());
    writeFileSync(root + '/' + name, bytes);
    return bytes;
  };
  const oldZip = await download(oldArchive.id, 'first-clearance.zip');
  const supplementalBody = {
    ...attachmentBody,
    fileName: '补充协议与补付款凭证-' + f.runId + '.txt',
  };
  const supplementalTicket = await api(
    'buyer/attachments/upload-ticket',
    b,
    supplementalBody,
  );
  assert.ok(
    (
      await fetch(apiBase + supplementalTicket.uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + b,
          'Content-Type': 'application/octet-stream',
        },
        body: Buffer.from(
          '上一版清算600元，双方补充协议增加150元，最终结算750元，当前年度来源A100/B50。' +
            f.runId,
        ),
      })
    ).ok,
  );
  const supplementalAttachment = await api('buyer/attachments', b, {
    ...supplementalBody,
    storageKey: supplementalTicket.storageKey,
  });
  const supplement = {
    ...proposal,
    requestKey: 'WITHDRAW-' + f.runId,
    previousSettlementId: originalSettlement.id,
    agreementId: supplementalAttachment.id,
    prices: [{ lineId: order.lineItems[0].id, unitPrice: 250 }],
    allocations: [{ source: c.invoiceId, goodsAmount: 750 }],
  };
  await api(
    path,
    b,
    {
      ...supplement,
      requestKey: 'STALE-' + f.runId,
      previousSettlementId: 'not-current',
    },
    'POST',
    [400, 409, 422],
  );
  let discarded = await api(path, b, supplement);
  await act(b, 'withdraw', discarded);
  discarded = await api(path, b, {
    ...supplement,
    requestKey: 'REJECT-' + f.runId,
  });
  await act(s, 'reject', discarded, sp);
  assert.equal(
    (await api('buyer/orders', b)).find((x) => x.id === c.orderId).status,
    '已清算',
  );
  assert.deepEqual(
    (await api(path + '/' + originalSettlement.id, b)).record,
    originalSettlement,
  );
  // The existing archive stays downloadable while the new bilateral agreement is reviewed.
  await p.reload();
  await panel
    .getByRole('button', { name: '发起补充清算', exact: true })
    .click();
  await panel
    .getByLabel('清算单价 ' + order.lineItems[0].description, { exact: true })
    .fill('250');
  await panel
    .getByLabel('FUND-' + f.runId + '清算货款', { exact: true })
    .fill('750');
  await panel
    .getByLabel('清算原因', { exact: true })
    .fill('新补充协议，最终货款750元，补付150元');
  await panel
    .getByRole('combobox', { name: /^共享给供应商的清算协议/ })
    .selectOption(supplementalAttachment.id);
  await panel
    .getByRole('button', { name: '提交供应商确认', exact: true })
    .click();
  await expect(
    panel.getByRole('button', { name: '提交供应商确认', exact: true }),
  ).toHaveCount(0);
  entry = (await api(path, b)).items.find(
    (x) => x.status === 'supplier_pending',
  );
  assert.ok(entry);
  result.settlementId = entry.id;
  assert.equal(
    JSON.parse(entry.snapshot).previousSettlementId,
    originalSettlement.id,
  );
  assert.deepEqual(
    await download(oldArchive.id, 'first-clearance-still-readable.zip'),
    oldZip,
  );
  entry = await act(s, 'accept', entry, sp);
  entry = await act(b, 'submit', entry);
  await decide('order_settlement', entry.id);
  entry = (await api(path + '/' + entry.id, b)).record;
  await p.reload();
  await panel
    .getByRole('row')
    .filter({ hasText: '待凭证清算' })
    .getByRole('button', { name: '详情', exact: true })
    .click();
  await panel
    .getByRole('combobox', { name: /^发票或款项归属/ })
    .selectOption(c.invoiceId);
  await panel.getByRole('combobox', { name: /^类型/ }).selectOption('payment');
  await panel.getByLabel('金额', { exact: true }).fill('150');
  await panel.getByLabel('凭证编号', { exact: true }).fill('TOPUP-' + f.runId);
  await panel
    .getByRole('combobox', { name: /^原件/ })
    .selectOption(supplementalAttachment.id);
  await panel
    .getByLabel('核对说明', { exact: true })
    .fill('当前年度来源按补充协议补付款');
  await expect(panel.getByLabel('回补来源 A', { exact: true })).toHaveCount(0);
  await panel.getByLabel('清算来源金额 A', { exact: true }).fill('100');
  await panel.getByLabel('清算来源金额 B', { exact: true }).fill('50');
  await shot(p, 'supplemental-current-year-topup');
  await panel.getByRole('button', { name: '登记凭证', exact: true }).click();
  await expect(panel.getByLabel('凭证编号', { exact: true })).toHaveValue('');
  await panel.getByRole('combobox', { name: /^类型/ }).selectOption('invoice');
  await panel.getByLabel('金额', { exact: true }).fill('750');
  await panel
    .getByLabel('凭证编号', { exact: true })
    .fill('INV-SECOND-' + f.runId);
  await panel.getByRole('button', { name: '登记凭证', exact: true }).click();
  await expect(panel.getByLabel('凭证编号', { exact: true })).toHaveValue('');
  await panel
    .getByRole('button', { name: '完成清算并归档合同', exact: true })
    .click();
  await expect(
    panel.getByText('清算完成', { exact: true }).first(),
  ).toBeVisible();
  detail = await api(path + '/' + entry.id, b);
  assert.equal(detail.netPaid, 750);
  assert.deepEqual(
    (await api(path + '/' + originalSettlement.id, b)).record,
    originalSettlement,
  );
  assert.deepEqual((await api(invoice, b)).entries, [original]);
  await p.reload();
  await panel
    .getByRole('button', { name: '详情', exact: true })
    .first()
    .click();
  await panel
    .getByRole('region', { name: '清算来源分账明细', exact: true })
    .scrollIntoViewIfNeeded();
  await shot(p, 'supplemental-final-desktop');
  const mobile = await open(390),
    mp = mobile.getByRole('region', {
      name: '合同解除与订单清算',
      exact: true,
    });
  await mp.getByRole('button', { name: '详情', exact: true }).first().click();
  await mp
    .getByRole('region', { name: '清算来源分账明细', exact: true })
    .scrollIntoViewIfNeeded();
  await shot(mobile, 'supplemental-final-mobile');
  const ex = await api('buyer/rfqs/' + c.rfqId + '/execution', b);
  assert.ok(ex.canArchive, JSON.stringify(ex.blockers));
  assert.equal(ex.orderAmount, 750);
  const yearly = (await api(ep + '/lifecycle/preview', b)).sources.filter(
    (x) => x.sourceType === 'rfq' && x.sourceId === c.rfqId,
  );
  assert.equal(yearly.find((x) => x.period === project.period).paidAmount, 600);
  assert.equal(yearly.find((x) => x.period === targetPeriod).paidAmount, 150);
  result.yearly = yearly;
  const lot = (await api(ep + '/packages', b)).find(
    (x) => x.info.id === c.packageId,
  );
  await api(ep + '/packages/' + c.packageId + '/close', b, {
    revision: lot.info.revision,
    reason: '补充清算完成，原档和最新净额核对一致',
  });
  const termination = await api(ep + '/lifecycle', b, {
    revision: (await api(ep, b)).project.revision,
    kind: 'liquidation',
    reason: '净付750保留历史600及当年150，释放剩余责任450',
    formData: {},
  });
  await decide('project_liquidation', termination.id);
  assert.equal((await api(ep, b)).project.status, 'terminated');
  const funds = (await api('buyer/funding', b)).items;
  result.balances = [...c.funds, ...future].map((id) => {
    const x = funds.find((v) => v.id === id);
    return { id, paid: x.paidAmount, reserved: x.reservedAmount };
  });
  assert.deepEqual(
    result.balances.map((x) => x.paid),
    [300, 300, 100, 50],
  );
  const archive = (
    await api('buyer/rfqs/' + c.rfqId + '/execution', b)
  ).archives.find((x) => !x.stale);
  assert.ok(archive);
  await download(archive.id, 'final-clearance.zip');
  assert.deepEqual(
    await download(oldArchive.id, 'first-clearance-after-supplement.zip'),
    oldZip,
  );
  result.checks.push(
    'Historical refund year and current responsibility restoration are explicit',
    'Supplier and independent workflow on both clearing versions',
    'Original900 cash and original600 clearing unchanged',
    'Real UI creates supplemental proposal and150 current-year topup',
    'Old ZIP byte identical before and after reopening',
    'Latest execution750 counted once, project termination releases450',
    'Desktop/mobile no overflow or runtime error',
  );
  assert.deepEqual(result.errors, []);
  result.passed = true;
} catch (e) {
  result.errors.push(e.stack);
  for (const [i, ctx] of contexts.entries())
    if (ctx.pages()[0])
      await ctx
        .pages()[0]
        .screenshot({ path: root + '/failure-' + i + '.png', fullPage: true });
} finally {
  for (const ctx of contexts) await ctx.close();
  await browser.close();
  writeFileSync(
    process.env.ACCEPTANCE_REPORT_PATH ||
      '.tmp/frozen-reopen-browser-result.json',
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  if (!result.passed) process.exitCode = 1;
}
