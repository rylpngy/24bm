import { expect, test, type Page } from '@playwright/test';

// 财务链行为级 E2E:不止断言元素可见,而是真实点击业务动作并验证后端守卫与状态推进。
// 演示数据基线:PB-2026-0001(付款申请均通过,待提交批次审批)、PB-2026-0002(存在阻断)。
// 用例设计为可重复执行:负向守卫不产生状态变更;状态推进用例对已推进状态做容忍。

// 付款批次已并入发票付款:从发票台账右上入口进入二级页。
async function openPaymentBatches(page: Page) {
  await page.goto('/?module=invoices');
  await page.getByRole('button', { name: /登录 \/ 注册/ }).click();
  await page.getByRole('button', { name: /登录系统/ }).click();
  await page.getByRole('button', { name: '付款批次', exact: true }).click();
  await expect(page.getByText('执行记录明细').first()).toBeVisible();
}

test('付款金额台账入口可访问且未审批批次被后端拦截(无状态变更)', async ({ page, request }) => {
  await openPaymentBatches(page);
  await page.getByRole('link', { name: '付款金额台账', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: '付款金额台账', exact: true })).toBeVisible();

  // 旧登记入口已移除，但直接调用仍须受服务端审批约束。
  const api = 'http://localhost:8080/api/v1';
  const login = await request.post(`${api}/auth/login`, { data: {
    account: 'buyer.owner@example.com', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-acme',
  } });
  expect(login.ok()).toBeTruthy();
  const headers = { Authorization: `Bearer ${(await login.json()).data.accessToken}` };
  const url = `${api}/buyer/payment-execution-records?paymentBatchNo=PB-2026-0001`;
  const beforeResponse = await request.get(url, { headers });
  expect(beforeResponse.ok()).toBeTruthy();
  const before = (await beforeResponse.json()).data;
  expect(before.length).toBeGreaterThan(0);
  const rejected = await request.post(`${api}/buyer/payment-execution-records/${before[0].id}/registration`, {
    headers, data: { paymentStatus: '已付款', releaseEvidenceNo: 'E2E-EVIDENCE-001' },
  });
  expect(rejected.ok()).toBeFalsy();
  expect(await rejected.text()).toContain('must be approved before payment execution registration');
  const afterResponse = await request.get(url, { headers });
  expect(afterResponse.ok()).toBeTruthy();
  // 列表读取会刷新执行汇总时间，仅排除汇总时间戳，金额、状态、凭据等业务字段必须完全一致。
  const businessState = (records: Array<Record<string, unknown>>) => records.map(({ updatedAt: _updatedAt, ...record }) => record);
  expect(businessState((await afterResponse.json()).data)).toEqual(businessState(before));
});

test('付款批次提交审批后进入统一流程状态与我发起台账', async ({ page }) => {
  await openPaymentBatches(page);

  // 首次运行:待提交审批 → 提交批次审批;重复运行时批次已在审批中,直接跳过提交。
  const submitBtn = page.getByRole('button', { name: '提交批次审批 PB-2026-0001' });
  if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await submitBtn.click();
    const submitDialogHeading = page.getByRole('heading', {
      name: /提交审批 · 付款批次 PB-2026-0001/,
    });
    await expect(submitDialogHeading).toBeVisible();
    await page.getByRole('button', { name: '确认提交' }).click();
    await expect(submitDialogHeading).toBeHidden({ timeout: 15_000 });
  }

  // 统一 Flowable 台账是流程已发起的权威验收信号，避免依赖业务页的瞬时刷新文案。
  await page.goto('/?module=approvals');
  await page.getByRole('button', { name: '我发起的' }).click();
  await page.getByRole('textbox', { name: '搜索流程台账' }).fill('PB-2026-0001');
  const searched = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/v1/buyer/workflow/instances/page'
      && url.searchParams.get('view') === 'initiated'
      && url.searchParams.get('keyword') === 'PB-2026-0001';
  });
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  const response = await searched;
  expect(response.ok()).toBeTruthy();
  const result = (await response.json()).data;
  expect(result.total).toBeGreaterThan(0);
  expect(result.items.some((item: { businessId: string }) => item.businessId === 'PB-2026-0001')).toBeTruthy();
  await expect(page.getByText('PB-2026-0001').first()).toBeVisible({ timeout: 15_000 });
});
