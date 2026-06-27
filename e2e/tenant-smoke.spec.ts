import { expect, test, type Page } from '@playwright/test';

// 采购方端冒烟:登录 → 工作台 → 供应商库(SRM)→ 供应商列表(表头/序号/分页)→ 采购需求。
// 覆盖真实链路:Keycloak 退役后的自研 JWT 登录(后端 /auth/login)+ 真数据列表渲染 + 统一工具条。

async function loginAsBuyer(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /以采购负责人登录/ }).click();
  // 登录成功后左侧出现全局导航。
  await expect(page.getByRole('button', { name: /供应商库/ })).toBeVisible();
}

test('采购方登录后可进入工作台', async ({ page }) => {
  await loginAsBuyer(page);
  await expect(page.getByRole('button', { name: /首页看板/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /采购需求/ })).toBeVisible();
});

test('供应商库列表:工具条 + 序号 + 分页', async ({ page }) => {
  await loginAsBuyer(page);
  await page.getByRole('button', { name: /供应商库/ }).click();

  // SRM 工作台二级导航 + 供应商列表(默认页)表头含序号。
  await expect(page.getByRole('columnheader', { name: '序号' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '供应商' })).toBeVisible();
  // 统一工具条:搜索框 + 分页计数。
  await expect(page.getByPlaceholder(/搜索/).first()).toBeVisible();
  await expect(page.getByText(/共\s*\d+\s*条/)).toBeVisible();
});

test('采购需求列表:序号列 + 搜索', async ({ page }) => {
  await loginAsBuyer(page);
  await page.getByRole('button', { name: /采购需求/ }).click();

  await expect(page.getByRole('columnheader', { name: '序号' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '标题' })).toBeVisible();
  await expect(page.getByPlaceholder(/搜索/).first()).toBeVisible();
});
