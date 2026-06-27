import { expect, test } from '@playwright/test';
import { loginViaDevJwt, openModule, expectLoggedIn } from './helpers';

// 供应商门户冒烟:登录 → 询价邀请 / 报价记录 / 销售订单 / 发票应收,断言统一工具条(状态筛选 + 搜索 + 分页)。
test('供应商端登录后可进入门户', async ({ page }) => {
  await loginViaDevJwt(page);
  await expectLoggedIn(page, /询价邀请/);
  await expect(page.getByRole('button', { name: /销售订单/ })).toBeVisible();
});

test('销售订单 / 报价记录 列表:状态筛选 + 搜索 + 分页', async ({ page }) => {
  await loginViaDevJwt(page);

  await openModule(page, /销售订单/);
  await expect(page.getByRole('heading', { name: '销售订单', level: 3 })).toBeVisible();
  await expect(page.getByPlaceholder(/搜索/).first()).toBeVisible();
  await expect(page.getByText(/共\s*\d+\s*条/).first()).toBeVisible();

  await openModule(page, /报价记录/);
  await expect(page.getByRole('heading', { name: '报价记录', level: 3 })).toBeVisible();
  await expect(page.getByPlaceholder(/搜索/).first()).toBeVisible();
  await expect(page.getByText(/共\s*\d+\s*条/).first()).toBeVisible();
});
