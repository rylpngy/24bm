import { expect, test } from '@playwright/test';
import { expectLoggedIn, loginViaKeycloak } from './helpers';

// G-3 i18n:顶栏语言开关真实切换骨架层文案,并跨刷新保持。
test('语言切换:中文 → English 切换导航与顶栏,刷新后保持', async ({ page }) => {
  await loginViaKeycloak(page);
  await expectLoggedIn(page, /采购需求/);

  // 默认中文。
  await expect(page.getByRole('complementary').getByRole('button', { name: /采购需求/ })).toBeVisible();

  await page.getByRole('button', { name: /简体中文/ }).click();
  await page.getByRole('button', { name: 'English', exact: true }).click();

  // 骨架层(导航 + 顶栏)转英文;业务页面正文按设计仍是中文。
  const nav = page.getByTestId('app-nav');
  await expect(nav.getByRole('button', { name: 'Requisitions' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Public portal/ })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');

  // 刷新后仍是英文(写入本地存储)。
  await page.reload();
  await expect(page.getByTestId('app-nav').getByRole('button', { name: 'Requisitions' })).toBeVisible();

  // 切回中文,恢复原状。
  await page.getByRole('button', { name: 'English' }).first().click();
  await page.getByRole('button', { name: '简体中文', exact: true }).click();
  await expect(page.getByTestId('app-nav').getByRole('button', { name: /采购需求/ })).toBeVisible();
});
