import { expect, test, type Page } from '@playwright/test';

// 财务链行为级 E2E:不止断言元素可见,而是真实点击业务动作并验证后端守卫与状态推进。
// 演示数据基线:PB-2026-0001(待执行,付款申请未全通过)、PB-2026-0002(存在阻断)。
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

test('付款批次提交审批推进状态;申请未全通过时审批被拒', async ({ page }) => {
  await openPaymentBatches(page);

  // 首次运行:待执行 → 提交批次审批;重复运行时批次已在审批中,直接跳过提交。
  const submitBtn = page.getByRole('button', { name: '提交批次审批 PB-2026-0001' });
  if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await submitBtn.click();
  }

  // 状态推进为「审批中」的证据:出现该批次的审批通过按钮。
  const approveBtn = page.getByRole('button', { name: '批次审批通过 PB-2026-0001' });
  await expect(approveBtn).toBeVisible();

  // 该批次付款申请未全部审批通过(已审批额 < 批次总额) → 审批被后端守卫拒绝。
  await approveBtn.click();
  await expect(
    page.getByText(/cannot be approved until all payment requests are approved/),
  ).toBeVisible();
});
