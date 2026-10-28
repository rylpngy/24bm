import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';

assert.equal(process.env.ACCEPTANCE_LOCAL_WRITES, '1');
assert.ok(process.env.ACCEPTANCE_PASSWORD);
const base = process.env.JAVA_API_BASE_URL || 'http://127.0.0.1:8097',
  preview = process.env.ACCEPTANCE_BROWSER_URL || 'http://127.0.0.1:5201';
assert.equal(
  new URL(base).origin,
  'http://127.0.0.1:8097',
  'Never write to original services',
);
assert.equal(new URL(preview).origin, 'http://127.0.0.1:5201');
const fixture = JSON.parse(
    readFileSync(
      process.env.PROJECT_REOPEN_FIXTURE || '.tmp/compensation-http.json',
    ),
  ),
  previous = JSON.parse(
    readFileSync(
      process.env.PROJECT_REOPEN_CLEARING ||
        '.tmp/compensation-browser-result.json',
    ),
  );
assert.ok(fixture.passed && previous.passed && previous.finalNet === 540);
const c = fixture.records.fundingUi;
assert.equal(previous.projectId, c.projectId);
assert.equal(previous.tenantId, fixture.tenantId);
const root = '/tmp/closed-project-reopen-' + Date.now();
mkdirSync(root, { mode: 0o700 });
const report = {
  passed: false,
  root,
  projectId: c.projectId,
  tenantId: fixture.tenantId,
  screenshots: [],
  errors: [],
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
  supplier = await login('supplier.sales@example.com', 'SUPPLIER'),
  b = buyer.accessToken,
  r = reviewer.accessToken,
  s = supplier.accessToken;
const ep = 'buyer/projects/' + c.projectId,
  path = 'buyer/orders/' + c.orderId + '/settlements',
  sp = 'supplier/orders/' + c.orderId + '/settlements';
async function decide(type, id, action = 'approve') {
  const task = (await api('buyer/workflow/tasks', r)).find(
    (t) => t.businessType === type && t.businessId === id,
  );
  assert.ok(task, 'Independent ' + type + ' task');
  assert.ok(
    !(await api('buyer/workflow/tasks', b)).some((t) => t.businessId === id),
    'Initiator must not handle reopening/clearing',
  );
  await api('buyer/workflow/tasks/' + task.taskId + '/complete', r, {
    action,
    comment: '核对关闭依据、现有来源容量及历史原件',
  });
}
async function download(url, name) {
  const response = await fetch(base + '/api/v1/' + url, {
    headers: { Authorization: 'Bearer ' + b },
  });
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), 'PK');
  writeFileSync(root + '/' + name, bytes);
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
  await page.goto(preview + '/?module=projects&recordId=' + c.projectId);
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
const project = async () => (await api(ep, b)).project;
const lot = async () =>
  (await api(ep + '/packages', b)).find((l) => l.info.id === c.packageId).info;
const reopen = async (reason, withPackage = true) =>
  api(ep + '/lifecycle', b, {
    revision: (await project()).revision,
    kind: 'reopen',
    reason,
    formData: {},
    ...(withPackage
      ? { packageId: c.packageId, packageRevision: (await lot()).revision }
      : {}),
  });
const act = (token, e, action, scope = path) =>
  api(scope + '/' + e.id + '/actions', token, {
    revision: e.revision,
    action,
    reason: '核对双方补充协议和实际凭据',
    formData: {},
  });
try {
  assert.equal((await project()).status, 'approved');
  assert.equal((await lot()).status, 'ready');
  assert.equal((await api('buyer/budgets/policy', b)).mode, 'warning');
  const role = (await api('buyer/roles', b)).find((x) =>
    x.permissions.includes('buyer:*'),
  );
  assert.ok(role);
  const definition = await api('buyer/process-definitions', b, {
    name: '已关闭项目受控重开验收',
    businessType: 'project_reopen',
    icon: 'file-text',
  });
  await api(
    'buyer/process-definitions/' + definition.id,
    b,
    {
      name: definition.name,
      businessType: 'project_reopen',
      status: 'draft',
      formSchema: '{"fields":[]}',
      flowSchema: JSON.stringify({
        steps: [
          {
            id: 'review',
            type: 'approver',
            title: '独立重开审核',
            assignment: { type: 'role', roleId: role.id },
          },
        ],
      }),
    },
    'PUT',
  );
  await api('buyer/process-definitions/' + definition.id + '/publish', b, {});
  const originalCash = (
    await api('buyer/invoices/' + c.invoiceId + '/payment-ledger', b)
  ).entries;
  const parent = (await api(path + '/' + previous.settlementIds[2], b)).record;
  const oldPackage = await download(
    'buyer/rfqs/' +
      c.rfqId +
      '/execution/archives/' +
      previous.archives[0] +
      '/download',
    '原清算分包.zip',
  );
  await api(ep + '/close', b, {
    revision: (await project()).revision,
    reason: '按净款540元完成项目结项',
    formData: {},
  });
  assert.equal((await project()).status, 'closed');
  assert.equal((await lot()).status, 'closed');
  const view = await api(
    ep + '/lifecycle/reopen-preview?packageId=' + c.packageId,
    b,
  );
  assert.deepEqual(view.blockers, []);
  assert.equal(view.restoreAmount, 660);
  assert.ok(
    (await api(ep + '/lifecycle/reopen-preview?packageId=foreign', b)).blockers
      .length > 0,
  );
  const withdrawn = await reopen('补充重开依据，先撤回');
  const closure = await download(
    ep + '/lifecycle/' + withdrawn.id + '/closure-archive',
    '原关闭整项目.zip',
  );
  await api(ep + '/lifecycle/' + withdrawn.id + '/withdraw', b, {
    revision: withdrawn.revision,
    reason: '补充材料',
    formData: {},
  });
  assert.equal((await project()).status, 'closed');
  assert.equal((await lot()).status, 'closed');
  const rejected = await reopen('独立审核后驳回补充资料');
  await decide('project_reopen', rejected.id, 'reject');
  assert.equal((await project()).status, 'closed');
  assert.deepEqual(
    await download(
      ep + '/lifecycle/' + rejected.id + '/closure-archive',
      '驳回后原关闭整项目.zip',
    ),
    closure,
  );
  const page = await open(1440),
    region = page.getByRole('region', {
      name: '项目及分包受控重开',
      exact: true,
    });
  await region.getByRole('button', { name: '申请项目重开' }).click();
  const dialog = page.getByRole('dialog', {
    name: '申请受控重开',
    exact: true,
  });
  await expect(dialog.getByText('拟恢复专项责任')).toBeVisible();
  await dialog
    .getByLabel('重开范围', { exact: true })
    .selectOption(c.packageId);
  await dialog
    .getByLabel('重开原因', { exact: true })
    .fill('项目与选定分包重开，用于补充清算');
  await expect(
    dialog.getByRole('button', { name: '提交重开审批' }),
  ).toBeEnabled();
  await shot(page, 'closed-project-reopen-proposal');
  await dialog.getByRole('button', { name: '提交重开审批' }).click();
  await page
    .getByRole('dialog', { name: '提交审批 · 项目及分包受控重开' })
    .getByRole('button', { name: '确认提交', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: '提交审批 · 项目及分包受控重开' }),
  ).toHaveCount(0);
  const request = (await api(ep + '/lifecycle', b)).items.find(
    (x) => x.kind === 'reopen' && x.status === 'submitted',
  );
  assert.ok(request);
  report.reopenId = request.id;
  assert.equal((await project()).status, 'closed');
  assert.equal((await lot()).status, 'closed');
  await decide('project_reopen', request.id);
  assert.equal((await project()).status, 'approved');
  assert.equal((await lot()).status, 'ready');
  assert.deepEqual(
    await download(
      ep + '/lifecycle/' + request.id + '/closure-archive',
      '重开后原关闭整项目.zip',
    ),
    closure,
  );
  assert.deepEqual(
    (await api('buyer/invoices/' + c.invoiceId + '/payment-ledger', b)).entries,
    originalCash,
  );
  assert.deepEqual((await api(path + '/' + parent.id, b)).record, parent);
  const metadata = {
      ownerType: 'order_settlement_document',
      ownerId: c.orderId,
      fileName: '重开后补充清算协议.txt',
      visibility: 'buyer_internal',
    },
    ticket = await api('buyer/attachments/upload-ticket', b, metadata);
  assert.ok(
    (
      await fetch(base + ticket.uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + b,
          'Content-Type': 'application/octet-stream',
        },
        body: Buffer.from(
          '货款480元、补偿90元，合计570元；实际补付货款30元。隔离验收样本。',
        ),
      })
    ).ok,
  );
  const file = await api('buyer/attachments', b, {
      ...metadata,
      storageKey: ticket.storageKey,
    }),
    order = (await api('buyer/orders', b)).find((x) => x.id === c.orderId);
  let clearing = await api(path, b, {
    requestKey: 'REOPEN-CLEAR-' + fixture.runId,
    previousSettlementId: parent.id,
    reason: '经独立重开审批后核验补充货款',
    compensation: 90,
    agreementId: file.id,
    prices: [{ lineId: order.lineItems[0].id, unitPrice: 160 }],
    allocations: [{ source: c.invoiceId, goodsAmount: 480 }],
  });
  assert.equal(JSON.parse(clearing.snapshot).projectReopenId, request.id);
  clearing = await act(s, clearing, 'accept', sp);
  clearing = await act(b, clearing, 'submit');
  await decide('order_settlement', clearing.id);
  clearing = (await api(path + '/' + clearing.id, b)).record;
  const current = JSON.parse(clearing.snapshot).funding.sources.find(
    (x) => !x.historical && x.code === 'A',
  );
  assert.ok(current);
  const proof = (key, kind, amount, source, extra = {}) =>
    api(path + '/' + clearing.id + '/evidence', b, {
      requestKey: key,
      kind,
      amount,
      source,
      evidenceNo: key,
      attachmentId: file.id,
      remark: '实际核验样本，不代表银行或税务处理',
      ...extra,
    });
  await proof('REOPEN-TOPUP', 'payment', 30, c.invoiceId, {
    cashPeriod: JSON.parse(clearing.snapshot).period,
    fundingLines: [{ fundId: current.fundId, amount: 30 }],
  });
  await proof('REOPEN-INVOICE', 'invoice', 480, c.invoiceId);
  await proof('REOPEN-COMP', 'compensation_receipt', 90, '~compensation');
  await act(b, clearing, 'complete');
  assert.equal((await api(path + '/' + clearing.id, b)).netPaid, 570);
  report.clearingId = clearing.id;
  await api(ep + '/packages/' + c.packageId + '/close', b, {
    revision: (await lot()).revision,
    reason: '补充清算后重新归档结项',
  });
  const liquidation = await api(ep + '/lifecycle', b, {
    revision: (await project()).revision,
    kind: 'liquidation',
    reason: '净付570保留，释放未用责任630',
    formData: {},
  });
  await decide('project_liquidation', liquidation.id);
  assert.equal((await project()).status, 'terminated');
  const again = await reopen('终止清算后因补充事项受控重开');
  assert.equal(again.amount, 630);
  await decide('project_reopen', again.id);
  assert.equal((await project()).status, 'approved');
  assert.equal((await lot()).status, 'ready');
  report.terminatedReopenId = again.id;
  assert.equal(
    (await api('buyer/invoices/' + c.invoiceId + '/payment-ledger', b))
      .entries[0].amount,
    900,
  );
  assert.deepEqual(
    await download(
      ep + '/lifecycle/' + request.id + '/closure-archive',
      '再次终止重开后原关闭整项目.zip',
    ),
    closure,
  );
  assert.deepEqual(
    await download(
      'buyer/rfqs/' +
        c.rfqId +
        '/execution/archives/' +
        previous.archives[0] +
        '/download',
      '重开后原清算分包.zip',
    ),
    oldPackage,
  );
  await api(
    ep + '/lifecycle',
    b,
    {
      revision: (await project()).revision,
      kind: 'reopen',
      reason: '重复重开不得再次占用',
      formData: {},
      packageId: c.packageId,
      packageRevision: (await lot()).revision,
    },
    'POST',
    [400, 409, 422],
  );
  for (const width of [1440, 390]) {
    const p = await open(width);
    await p
      .getByRole('region', { name: '跨年度承接与终止清算', exact: true })
      .getByRole('button', { name: '展开办理台账' })
      .click();
    const row = p
      .getByRole('row')
      .filter({ hasText: '终止清算后因补充事项受控重开' });
    await row.getByRole('button', { name: '详情', exact: true }).click();
    await expect(
      p.getByRole('region', { name: '重开依据', exact: true }).first(),
    ).toContainText('已终止');
    await shot(p, 'reopen-history-' + width);
  }
  const latest = await api('buyer/rfqs/' + c.rfqId + '/execution/archives', b, {
    remark: '受控重开后的完整审批与清算档案',
  });
  await download(
    'buyer/rfqs/' + c.rfqId + '/execution/archives/' + latest.id + '/download',
    '最新采购执行.zip',
  );
  report.archiveId = latest.id;
  report.finalNet = 570;
  report.restoredResponsibility = [660, 630];
  report.checks.push(
    'UI selects closed package and submits configured independent workflow',
    'Withdrawal and rejection preserve closure; retry reuses original ZIP',
    'Approved project and selected package reopen only',
    'Original cash900 and prior clearing540 unchanged',
    'Supplemental agreement completes at570 after new supplier confirmation and approval',
    'Terminated project reopens with630 source responsibility restored',
    'Original project/package ZIPs byte identical',
    'Desktop/mobile history and preserved closure download visible',
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
      '.tmp/project-reopen-browser-result.json',
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  if (!report.passed) process.exitCode = 1;
}
