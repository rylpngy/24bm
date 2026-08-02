import { expect, test } from '@playwright/test';
import { loginViaKeycloak } from './helpers';

// G-2 移动端(供应商端):同一 AppShell 抽屉行为 + 台账页无页面级横向滚动。
test.use({ viewport: { width: 375, height: 812 } });

test('移动视口:供应商端抽屉导航与台账页横向溢出检查', async ({ page }) => {
  await loginViaKeycloak(page);

  const hamburger = page.getByRole('button', { name: '打开导航' });
  await expect(hamburger).toBeVisible();
  await hamburger.click();
  const drawer = page.getByTestId('app-nav');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('button', { name: /销售订单/ }).click();
  await expect(drawer).toBeHidden();

  for (const module of [/销售订单/, /发货管理/, /资质认证/]) {
    if (!(await page.getByRole('button', { name: '打开导航' }).isVisible())) break;
    await page.getByRole('button', { name: '打开导航' }).click();
    const target = page.getByTestId('app-nav').getByRole('button', { name: module });
    if (!(await target.isVisible().catch(() => false))) {
      await page.keyboard.press('Escape');
      continue;
    }
    await target.click();
    await expect(page.getByTestId('app-nav')).toBeHidden();
    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return { scroll: el.scrollWidth, client: el.clientWidth };
    });
    expect(overflow.scroll, `${module} 页面横向溢出`).toBeLessThanOrEqual(overflow.client);
  }
});
