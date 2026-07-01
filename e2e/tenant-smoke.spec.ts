import { expect, test, type Page } from '@playwright/test';
import { loginViaKeycloak } from './helpers';

// 采购方端冒烟:登录 → 工作台 → 供应商库(SRM)→ 供应商列表(表头/序号/分页)→ 采购需求。
// 覆盖真实链路:Keycloak 登录 + 真数据列表渲染 + 统一工具条。

async function loginAsBuyer(page: Page) {
  await loginViaKeycloak(page);
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

test('合同页显示合同-付款对账视图', async ({ page }) => {
  await page.goto('/?module=contracts');
  await page.getByRole('button', { name: /Keycloak 登录/ }).click();

  await expect(page.getByText('合同-付款对账视图')).toBeVisible();
  await expect(page.getByText('待核差额')).toBeVisible();
  await expect(page.getByRole('button', { name: /存在付款阻断/ })).toBeVisible();
  await expect(page.getByText(/合同付款登记覆盖/).first()).toBeVisible();
  await expect(page.getByText(/付款链路/).first()).toBeVisible();
});
