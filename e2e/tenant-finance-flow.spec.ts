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

test('登记付款证据表单:未审批批次被后端守卫拦截(无状态变更)', async ({ page }) => {
  await openPaymentBatches(page);

  // 展开第一条待登记付款记录的放款证据表单并提交。
  await page.getByRole('button', { name: '登记付款', exact: true }).first().click();
  await page.getByPlaceholder(/放款凭证号/).fill('E2E-EVIDENCE-001');
  await page.getByPlaceholder(/放款备注/).fill('E2E 行为验证付款流水');
  await page.getByRole('button', { name: '确认登记付款' }).click();

  // 批次未审批通过 → 后端拒绝,错误浮出到页面。
  await expect(
    page.getByText(/must be approved before payment execution registration/),
  ).toBeVisible();
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
  await page.getByPlaceholder('搜索业务单号、节点或发起人').fill('PB-2026-0001');
  await expect(page.getByText('PB-2026-0001').first()).toBeVisible({ timeout: 15_000 });
});
