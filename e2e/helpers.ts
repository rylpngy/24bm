import { expect, type Page } from '@playwright/test';

// 通用:走各端登录门的"自研 JWT(开发后备)"按钮(打到后端 /auth/login)。
// 采购方登录门已拆为多演示角色按钮(以采购管理员登录),其余端仍为单一"自研 JWT"按钮。
export async function loginViaDevJwt(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /自研 JWT|采购管理员/ }).first().click();
}

// 点左侧全局导航某模块(导航按钮可见名含模块名)。
export async function openModule(page: Page, name: string | RegExp) {
  await page.getByRole('button', { name }).first().click();
}

// 断言已离开登录门(进入工作台)。
export async function expectLoggedIn(page: Page, anyNav: string | RegExp) {
  await expect(page.getByRole('button', { name: anyNav }).first()).toBeVisible();
}
