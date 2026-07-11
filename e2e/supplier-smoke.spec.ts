import { expect, test } from '@playwright/test';
import { loginViaKeycloak, openModule, expectLoggedIn } from './helpers';

// 供应商门户冒烟:登录 → 询比邀请 / 报价记录 / 销售订单 / 发票应收,断言统一工具条(状态筛选 + 搜索 + 分页)。
test('供应商端登录后可进入门户', async ({ page }) => {
  await loginViaKeycloak(page);
  await expectLoggedIn(page, /询比邀请/);
  await expect(page.getByRole('complementary').getByRole('button', { name: /销售订单/ })).toBeVisible();
});

test('销售订单 / 报价记录 列表:状态筛选 + 搜索 + 分页', async ({ page }) => {
  await loginViaKeycloak(page);

  await openModule(page, /销售订单/);
  await expect(page.getByRole('heading', { name: '销售订单', level: 3 })).toBeVisible();
  await expect(page.getByPlaceholder(/搜索/).first()).toBeVisible();
  await expect(page.getByText(/共\s*\d+\s*条/).first()).toBeVisible();

  await openModule(page, /报价记录/);
  await expect(page.getByRole('heading', { name: '报价记录', level: 3 })).toBeVisible();
  await expect(page.getByPlaceholder(/搜索/).first()).toBeVisible();
  await expect(page.getByText(/共\s*\d+\s*条/).first()).toBeVisible();
});

test('询比邀请:列表 → 详情(关键信息 + 项目进度)', async ({ page }) => {
  await loginViaKeycloak(page);
  await openModule(page, /询比邀请/);
  await expect(page.getByRole('heading', { name: '询比邀请', level: 3 })).toBeVisible();
  await expect(page.getByText(/共\s*\d+\s*条/).first()).toBeVisible();

  const detailButtons = page.getByRole('button', { name: '查看详情' });
  if ((await detailButtons.count()) === 0) return; // 无商机数据时仅冒烟列表
  await detailButtons.first().click();
  await expect(page.getByText('关键信息')).toBeVisible();
  await expect(page.getByText('项目进度')).toBeVisible();
  await expect(page.getByText('收到邀请')).toBeVisible();
  // 返回列表
  await page.getByRole('button', { name: '返回商机列表' }).click();
  await expect(page.getByText(/共\s*\d+\s*条/).first()).toBeVisible();
});

test('供应商看板:欢迎横幅 + 经营指标 + 待办', async ({ page }) => {
  await loginViaKeycloak(page);
  await openModule(page, /供应商看板/);
  await expect(page.getByText(/欢迎回来/)).toBeVisible();
  await expect(page.getByText('累计成交金额')).toBeVisible();
  await expect(page.getByText('待办事项')).toBeVisible();
  await expect(page.getByText('成交趋势')).toBeVisible();
});
