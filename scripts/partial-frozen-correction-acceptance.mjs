import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';

assert.equal(process.env.ACCEPTANCE_LOCAL_WRITES, '1');
assert.ok(process.env.ACCEPTANCE_PASSWORD);
const base = process.env.JAVA_API_BASE_URL || 'http://127.0.0.1:8097';
const preview = process.env.ACCEPTANCE_BROWSER_URL || 'http://127.0.0.1:5201';
assert.equal(new URL(base).origin, 'http://127.0.0.1:8097');
assert.equal(new URL(preview).origin, 'http://127.0.0.1:5201');
const fixture = JSON.parse(
  readFileSync(
    process.env.PARTIAL_CORRECTION_FIXTURE ||
      '.tmp/partial-correction-http.json',
  ),
);
assert.ok(fixture.passed && fixture.records.fundingUi);
const c = fixture.records.fundingUi;
const root = '/tmp/partial-frozen-correction-' + Date.now();
mkdirSync(root, { mode: 0o700 });
const report = {
  passed: false,
  root,
  tenantId: fixture.tenantId,
  projectId: c.projectId,
  errors: [],
  screenshots: [],
  checks: [],
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
  const data = await response.json();
  assert.ok(
    expected.includes(response.status),
    path + ': ' + response.status + ' ' + data.message,
  );
  return data.data;
}
const login = (account) =>
  api('auth/login', null, {
    account,
    password: process.env.ACCEPTANCE_PASSWORD,
    scope: 'BUYER',
    tenantId: fixture.tenantId,
  });
const buyer = await login(fixture.account),
  reviewer = await login(fixture.reviewerAccount);
const b = buyer.accessToken,
  r = reviewer.accessToken,
  ep = 'buyer/projects/' + c.projectId;
const ledger = 'buyer/invoices/' + c.invoiceId + '/payment-ledger',
  corrections = ledger + '/corrections';
async function decide(type, id, action = 'approve') {
  const task = (await api('buyer/workflow/tasks', r)).find(
    (t) => t.businessType === type && t.businessId === id,
  );
  assert.ok(task, 'Independent task ' + type);
  assert.ok(
    !(await api('buyer/workflow/tasks', b)).some((t) => t.businessId === id),
    'Initiator cannot approve',
  );
  await api('buyer/workflow/tasks/' + task.taskId + '/complete', r, {
    action,
    comment:
      '隔离验收凭据：核对本次部分更正、原来源余额及当前年度责任，不代表银行退款',
  });
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
    ({ s, t }) =>
      localStorage.setItem(
        '24bid.tenant-portal.session',
        JSON.stringify({
          token: s.accessToken,
          userId: s.userId,
          displayName: s.displayName,
          tenantId: t,
        }),
      ),
    { s: buyer, t: fixture.tenantId },
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() === 'error') report.errors.push(e.text());
  });
  await page.goto(preview + '/?module=invoices&recordId=' + c.invoiceId);
  return page;
}
async function shot(page, name) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    'Whole-page overflow',
  );
  const file = root + '/' + name + '.png';
  await page.screenshot({ path: file });
  report.screenshots.push(file);
}
try {
  const project = (await api(ep, b)).project,
    year = Number(project.period);
  assert.equal(
    (await api(ledger, b)).paidAmount,
    0,
    'Use a fresh unpaid fixture',
  );
  assert.equal((await api('buyer/budgets/policy', b)).mode, 'warning');
  const plan = await api('buyer/funding/changes', b, {
    requestKey: 'partial-plan-' + fixture.runId,
    kind: 'project_plan',
    projectId: c.projectId,
    revision: project.revision,
    amount: 1200,
    lines: [
      { fundId: c.funds[0], amount: 700 },
      { fundId: c.funds[1], amount: 500 },
    ],
    reason: '隔离验收，明确原年度来源',
    formData: {},
  });
  await decide('funding_change', plan.id);
  const future = [];
  for (const code of ['A', 'B']) {
    const fund = await api('buyer/funding', b, {
      departmentId: project.departmentId,
      period: String(year + 1),
      code,
      name: '部分更正当前来源 ' + code,
    });
    const limit = await api('buyer/funding/changes', b, {
      requestKey: fund.id,
      kind: 'fund_limit',
      fundId: fund.id,
      revision: fund.revision,
      amount: 1500,
      reason: '当前年度来源额度独立审批',
      formData: {},
    });
    await decide('funding_change', limit.id);
    future.push(fund.id);
  }
  const batch = 'PARTIAL-' + fixture.runId;
  const payment = await api('buyer/payment-requests', b, {
    invoiceId: c.invoiceId,
    requestStatus: '付款申请待提交',
    paymentBatchNo: batch,
    remark: '隔离付款凭据，非真实银行出款',
  });
  await api(
    'buyer/payment-requests/' + payment.id + '/status',
    b,
    { requestStatus: '付款申请审批中', formData: {} },
    'PUT',
  );
  await decide('payment_request', payment.id);
  await api(
    'buyer/payment-batches/' + batch + '/status',
    b,
    { batchStatus: '审批中', formData: {} },
    'PUT',
  );
  await decide('payment_batch', batch);
  await api(ledger, b, {
    idempotencyKey: batch,
    amount: 200,
    evidenceNo: 'SAMPLE-ORIGINAL-' + fixture.runId,
    fundingLines: [
      { fundId: c.funds[0], amount: 150 },
      { fundId: c.funds[1], amount: 50 },
    ],
  });
  const original = (await api(ledger, b)).entries[0];
  report.originalEntryId = original.id;
  const carry = await api(ep + '/lifecycle', b, {
    revision: (await api(ep, b)).project.revision,
    kind: 'carryover',
    targetPeriod: String(year + 1),
    reason: '原200保留，只承接未付1000',
    formData: {},
    fundingSources: c.funds.map((sourceFundId, i) => ({
      sourceFundId,
      targetFundId: future[i],
    })),
  });
  await decide('project_carryover', carry.id);
  const carryHistory = (await api(ep + '/lifecycle', b)).items.map((x) => ({
    id: x.id,
    snapshot: x.snapshot,
  }));
  const draft = (key, amount, shares) => ({
    requestKey: key + fixture.runId,
    entryId: original.id,
    amount,
    evidenceNo: 'SAMPLE-' + key,
    reason: '核验原付款后按实际来源部分更正，不冒称实际银行退款',
    formData: {},
    fundingTargets: shares.map(([i, amount]) => ({
      sourceFundId: c.funds[i],
      targetFundId: future[i],
      amount,
    })),
  });
  const withdrawn = await api(
    corrections,
    b,
    draft('withdraw', 60, [
      [0, 40],
      [1, 20],
    ]),
  );
  await api(corrections + '/' + withdrawn.id + '/withdraw', b, {
    reason: '补充核对凭据',
  });
  const rejected = await api(
    corrections,
    b,
    draft('reject', 60, [
      [0, 40],
      [1, 20],
    ]),
  );
  await decide('frozen_payment_correction', rejected.id, 'reject');
  assert.equal((await api(ledger, b)).paidAmount, 200);
  const page = await open(1440),
    panel = page.getByRole('region', { name: '跨年冻结付款更正', exact: true });
  await panel.getByRole('button', { name: '更正台账', exact: true }).click();
  await panel.getByRole('button', { name: '申请更正', exact: true }).click();
  await page.getByLabel('本次更正金额', { exact: true }).fill('60');
  await page
    .getByLabel('更正凭据号', { exact: true })
    .fill('SAMPLE-FIRST-PARTIAL');
  await page
    .getByLabel('更正原因', { exact: true })
    .fill('原200中核实60需更正，A冲回40、B冲回20，其余140仍为原年冻结责任');
  await page
    .getByLabel('更正回补来源 A', { exact: true })
    .selectOption(future[0]);
  await page.getByLabel('来源更正金额 A', { exact: true }).fill('40');
  await page
    .getByLabel('更正回补来源 B', { exact: true })
    .selectOption(future[1]);
  await page.getByLabel('来源更正金额 B', { exact: true }).fill('10');
  await expect(
    page.getByRole('button', { name: '下一步', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('来源更正金额 B', { exact: true }).fill('20');
  await shot(page, 'partial-source-form-1440');
  await page.getByRole('button', { name: '下一步', exact: true }).click();
  await page.getByRole('button', { name: '确认提交', exact: true }).click();
  await expect(
    panel.getByText('办理完成，付款及年度责任台账已更新。', { exact: true }),
  ).toBeVisible();
  const first = (await api(corrections, b)).items[0];
  report.correctionIds = [first.id];
  await decide('frozen_payment_correction', first.id);
  assert.equal((await api(ledger, b)).paidAmount, 140);
  assert.equal((await api(ep + '/funding', b)).priorPaidAmount, 140);
  const second = await api(corrections, b, draft('second', 40, [[0, 40]]));
  await decide('frozen_payment_correction', second.id);
  report.correctionIds.push(second.id);
  assert.equal((await api(ledger, b)).paidAmount, 100);
  const candidate = (await api(corrections + '/candidates', b)).find(
    (x) => x.entryId === original.id,
  );
  assert.equal(candidate.amount, 200);
  assert.equal(candidate.remainingAmount, 100);
  assert.deepEqual(candidate.blockers, []);
  const funding = await api(ep + '/funding', b);
  assert.equal(funding.priorPaidAmount, 100);
  assert.equal(
    funding.sources.reduce((n, x) => n + x.allocatedAmount, 0),
    1100,
  );
  const current = await api(ledger, b);
  assert.deepEqual(
    current.entries.find((x) => x.id === original.id),
    original,
  );
  assert.equal(
    current.entries
      .filter((x) => x.reversalOf === original.id)
      .reduce((n, x) => n + x.amount, 0),
    -100,
  );
  assert.deepEqual(
    (await api(ep + '/lifecycle', b)).items.map((x) => ({
      id: x.id,
      snapshot: x.snapshot,
    })),
    carryHistory,
  );
  await page.reload();
  await panel.getByRole('button', { name: '更正台账', exact: true }).click();
  const row = panel
    .getByRole('row')
    .filter({ hasText: '核验原付款后按实际来源部分更正' })
    .first();
  await row.getByRole('button', { name: '详情', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByText('流程已结束', { exact: true }),
  ).toBeVisible();
  await shot(page, 'partial-approved-1440');
  const mobile = await open(390),
    mobilePanel = mobile.getByRole('region', {
      name: '跨年冻结付款更正',
      exact: true,
    });
  await mobilePanel
    .getByRole('button', { name: '更正台账', exact: true })
    .click();
  await mobilePanel
    .getByRole('button', { name: '详情', exact: true })
    .first()
    .click();
  await expect(
    mobile.getByRole('dialog').getByText('流程已结束', { exact: true }),
  ).toBeVisible();
  await shot(mobile, 'partial-approved-390');
  await api(ledger, b, {
    idempotencyKey: 'finish-' + fixture.runId,
    amount: 800,
    evidenceNo: 'SAMPLE-CURRENT-PAYMENT',
    fundingLines: [
      { fundId: future[0], amount: 500 },
      { fundId: future[1], amount: 300 },
    ],
  });
  assert.equal((await api(ledger, b)).paidAmount, 900);
  await api(
    'buyer/contracts/' + c.contractId + '/archive-status',
    b,
    { archiveStatus: '已归档' },
    'PUT',
  );
  const lot = (await api(ep + '/packages', b)).find(
    (x) => x.info.id === c.packageId,
  );
  await api(ep + '/packages/' + c.packageId + '/close', b, {
    revision: lot.info.revision,
    reason: '部分更正后完成真实履约与付款核验',
  });
  await api(ep + '/close', b, {
    revision: (await api(ep, b)).project.revision,
    reason: '原来源100、当前来源800，完整归档并释放300',
  });
  const archive = await api(
    'buyer/rfqs/' + c.rfqId + '/execution/archives',
    b,
    { remark: '分次冻结付款更正及原来源责任闭环' },
  );
  const response = await fetch(
    base +
      '/api/v1/buyer/rfqs/' +
      c.rfqId +
      '/execution/archives/' +
      archive.id +
      '/download',
    { headers: { Authorization: 'Bearer ' + b } },
  );
  assert.equal(response.status, 200);
  const zip = root + '/partial-correction.zip';
  writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
  const snapshot = JSON.parse(
    execFileSync('unzip', ['-p', zip, '业务快照.json'], {
      maxBuffer: 16000000,
    }),
  );
  assert.equal(
    snapshot.frozenPaymentCorrections.filter((x) => x.status === 'approved')
      .length,
    2,
  );
  assert.equal(
    snapshot.fundingRestorations.reduce((n, x) => n + x.amount, 0),
    100,
  );
  const funds = (await api('buyer/funding', b)).items;
  assert.equal(
    [...c.funds, ...future].reduce(
      (n, id) => n + funds.find((x) => x.id === id).reservedAmount,
      0,
    ),
    900,
  );
  assert.equal((await api('buyer/budgets/policy', b)).mode, 'warning');
  assert.deepEqual(report.errors, []);
  report.finalNet = 900;
  report.archiveId = archive.id;
  report.checks.push(
    'Withdraw/reject leave original 200 unchanged',
    'Actual UI submits 60 with explicit A40/B20; independent approval leaves 140 frozen',
    'Nonconsecutive second approval corrects A40, original remains unchanged and residual frozen is 100',
    'Current liability is 1100 and prior paid 100, original carryover snapshot unchanged',
    'Desktop/mobile history and source proof; no overflow/runtime errors',
    'Additional actual payment ledger 800; contract archive, package/project close and real ZIP download retain both approvals and three source restoration rows',
  );
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
    process.env.PARTIAL_CORRECTION_REPORT ||
      '.tmp/partial-correction-browser-result.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  if (!report.passed) process.exitCode = 1;
}
