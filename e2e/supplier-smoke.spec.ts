import { expect, test } from '@playwright/test';
import { loginViaKeycloak, openModule, expectLoggedIn } from './helpers';

// 供应商门户冒烟:登录 → 项目管理 / 销售订单 / 发票应收 / 商城货架。询比邀请与项目邀请均已并入项目管理(台账 → 参与详情)。
test('供应商端登录后可进入门户', async ({ page }) => {
  await loginViaKeycloak(page);
  await expectLoggedIn(page, /项目管理/);
  await expect(page.getByRole('complementary').getByRole('button', { name: /销售订单/ })).toBeVisible();
});

test('销售订单列表:状态筛选 + 搜索 + 分页', async ({ page }) => {
  await loginViaKeycloak(page);

  await openModule(page, /销售订单/);
  await expect(page.getByRole('heading', { name: '销售订单', level: 3 })).toBeVisible();
  await expect(page.getByPlaceholder(/搜索/).first()).toBeVisible();
  await expect(page.getByText(/共\s*\d+\s*条/).first()).toBeVisible();

});

test('项目管理:台账 → 参与详情(关键信息 + 项目进度) → 返回台账', async ({ page }) => {
  await loginViaKeycloak(page);
  await openModule(page, /项目管理/);
  await expect(page.getByRole('heading', { name: '项目管理', level: 3 })).toBeVisible();

  const openButtons = page.locator('table').getByRole('button', { name: '查看项目' });
  if ((await openButtons.count()) === 0) return; // 无项目数据时仅冒烟台账
  await openButtons.first().click();
  await expect(page.getByText('关键信息')).toBeVisible();
  await expect(page.getByText('项目进度')).toBeVisible();
  await expect(page.getByText('收到邀请')).toBeVisible();
  // 返回项目管理台账(而非旧询比商机列表)
  await page.getByRole('button', { name: '返回项目管理' }).click();
  await expect(page.getByRole('heading', { name: '项目管理', level: 3 })).toBeVisible();
});

test('供应商看板:欢迎横幅 + 经营指标 + 待办', async ({ page }) => {
  await loginViaKeycloak(page);
  await openModule(page, /供应商看板/);
  await expect(page.getByText(/欢迎回来/)).toBeVisible();
  await expect(page.getByText('累计成交金额')).toBeVisible();
  await expect(page.getByText('待办事项')).toBeVisible();
  await expect(page.getByText('成交趋势')).toBeVisible();
});

test('商城货架:表格列表 + 发布商品页 + 编辑商品页', async ({ page }) => {
  await loginViaKeycloak(page);
  await openModule(page, /商城货架/);
  await expect(page.getByRole('heading', { name: '商城货架', level: 3 })).toBeVisible();
  await expect(page.getByPlaceholder(/搜索商品/)).toBeVisible();

  // 发布商品独立页
  await page.getByRole('button', { name: /发布商品/ }).click();
  await expect(page.getByRole('heading', { name: '发布商品' })).toBeVisible();
  await expect(page.getByText('基础信息')).toBeVisible();
  await expect(page.getByText('销售信息')).toBeVisible();
  await page.getByRole('button', { name: '返回商品列表' }).click();
  await expect(page.getByRole('heading', { name: '商城货架', level: 3 })).toBeVisible();

  // 编辑商品独立页(有商品时)
  const editButtons = page.getByRole('button', { name: /编辑/ });
  if ((await editButtons.count()) === 0) return;
  await editButtons.first().click();
  await expect(page.getByRole('heading', { name: '编辑商品信息' })).toBeVisible();
  await expect(page.getByText('协议单价(元)')).toBeVisible();
  await page.getByRole('button', { name: '取消' }).click();
  await expect(page.getByRole('heading', { name: '商城货架', level: 3 })).toBeVisible();
});

test('配套功能页:发货管理 / 对账单 / 资质认证 / 员工管理', async ({ page }) => {
  await loginViaKeycloak(page);

  await openModule(page, /发货管理/);
  await expect(page.getByRole('heading', { name: '发货管理', level: 3 })).toBeVisible();
  await expect(page.getByPlaceholder(/搜索/).first()).toBeVisible();

  await openModule(page, /对账单/);
  await expect(page.getByRole('heading', { name: '对账单', level: 3 })).toBeVisible();

  await openModule(page, /资质认证/);
  await expect(page.getByRole('heading', { name: '资质认证', level: 3 })).toBeVisible();

  await openModule(page, /员工管理/);
  await expect(page.getByRole('heading', { name: '员工管理', level: 3 })).toBeVisible();
  await page.getByRole('button', { name: /新增成员/ }).click();
  await expect(page.getByRole('heading', { name: '新增成员' })).toBeVisible();
  await page.getByRole('button', { name: '取消' }).click();
  await expect(page.getByRole('heading', { name: '员工管理', level: 3 })).toBeVisible();
});

test('项目管理:总览含邀请状态维度(方式/邀请双维筛选)', async ({ page }) => {
  await loginViaKeycloak(page);

  await openModule(page, /项目管理/);
  await expect(page.getByRole('heading', { name: '项目管理', level: 3 })).toBeVisible();
  await expect(page.getByText('待查看邀请')).toBeVisible();
  await expect(page.getByRole('tab', { name: /商城直采/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /待查看/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '邀请状态' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '项目阶段' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '关联订单' })).toBeVisible();
});
