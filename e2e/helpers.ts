import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

async function fillPortalCredentials(page: Page) {
  const project = test.info().project.name;
  if (project !== 'platform' && project !== 'supplier') return;
  await page.getByLabel('账号', { exact: true }).fill(
    project === 'platform' ? 'platform.admin@example.com' : 'supplier.sales@example.com',
  );
  await page.getByLabel('密码', { exact: true }).fill('demo123456');
  if (project === 'supplier') await page.getByLabel('企业编号', { exact: true }).fill('ent-supplier-sunrise');
}

// 通用:走各端登录门的 Keycloak 主登录路径。
export async function loginViaKeycloak(page: Page) {
  await page.goto('/');
  const portalLogin = page.getByRole('button', { name: /登录 \/ 注册/ }).first();
  if (await portalLogin.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await portalLogin.click();
  }
  await fillPortalCredentials(page);
  await page.getByRole('button', { name: /登录系统|Keycloak 登录/ }).click();
}

// 通用:走各端登录门的"自研 JWT(开发后备)"按钮(打到后端 /auth/login)。
// 采购方登录门已拆为多演示角色按钮(以采购管理员登录),其余端仍为单一"自研 JWT"按钮。
export async function loginViaDevJwt(page: Page) {
  await page.goto('/');
  const portalLogin = page.getByRole('button', { name: /登录 \/ 注册/ }).first();
  if (await portalLogin.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await portalLogin.click();
  }
  await fillPortalCredentials(page);
  await page.getByRole('button', { name: /自研 JWT|采购管理员|账号登录/ }).first().click();
}

// 左侧全局导航(aside)里的模块按钮;限定侧边栏范围,避免匹配到工作台快捷操作。
export function navButton(page: Page, name: string | RegExp) {
  return page.getByRole('complementary').getByRole('button', { name });
}

// 点左侧全局导航某模块(导航按钮可见名含模块名)。
export async function openModule(page: Page, name: string | RegExp) {
  await navButton(page, name).first().click();
}

// 断言已离开登录门(进入工作台)。
export async function expectLoggedIn(page: Page, anyNav: string | RegExp) {
  await expect(navButton(page, anyNav).first()).toBeVisible();
}

const MALL_API = 'http://localhost:8080/api/v1';

/**
 * 商城造数辅助(M-4 起):供应商提审后,商品需采购方审核通过才在架。
 * 各用例只关心「有一个在架商品」,审核细节收在这里,避免每个文件重复三段请求。
 */
export async function approveProduct(request: APIRequestContext, productId: string) {
  const buyer = (await (await request.post(`${MALL_API}/auth/login`, {
    data: { account: 'buyer.owner@example.com', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-acme' },
  })).json()).data.accessToken as string;
  const res = await request.post(`${MALL_API}/buyer/mall/products/${productId}/review`, {
    headers: { Authorization: `Bearer ${buyer}` },
    data: { approved: true, comment: 'E2E 审核通过' },
  });
  expect(res.ok(), '商品审核未通过').toBeTruthy();
}
