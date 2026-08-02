import { expect, test } from '@playwright/test';
import { loginViaKeycloak } from './helpers';

// G-2 移动端:lg 以下无常驻侧栏,导航靠顶栏汉堡键唤出的抽屉。
test.use({ viewport: { width: 375, height: 812 } });

test('移动视口:汉堡唤出导航抽屉 → 选模块后自动收起 → 页面无横向滚动', async ({ page }) => {
  await loginViaKeycloak(page);

  // 手机视口下侧栏隐藏,顶栏出现汉堡键。
  const hamburger = page.getByRole('button', { name: '打开导航' });
  await expect(hamburger).toBeVisible();
  await expect(page.getByTestId('app-nav')).toBeHidden();

  // 唤出抽屉:模块清单可见。
  await hamburger.click();
  const drawer = page.getByTestId('app-nav');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: /采购需求/ })).toBeVisible();

  // 选模块后抽屉自动收起(移动端屏幕小,选完不该继续遮挡内容)。
  await drawer.getByRole('button', { name: /采购需求/ }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByRole('heading', { name: '采购需求', level: 3 })).toBeVisible();

  // 页面本身不得横向滚动(宽内容只能在自己的滚动容器里横滚)。
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return { scroll: el.scrollWidth, client: el.clientWidth };
  });
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);

  // Esc 关闭:抽屉打开后须有确定的退出路径。
  await page.getByRole('button', { name: '打开导航' }).click();
  await expect(page.getByTestId('app-nav')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('app-nav')).toBeHidden();
});

test('移动视口:台账页与详情页均无页面级横向滚动', async ({ page }) => {
  await loginViaKeycloak(page);
  for (const module of [/采购订单/, /发票付款/, /供应商库/, /招标管理/]) {
    await page.getByRole('button', { name: '打开导航' }).click();
    await page.getByTestId('app-nav').getByRole('button', { name: module }).click();
    await expect(page.getByTestId('app-nav')).toBeHidden();
    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return { scroll: el.scrollWidth, client: el.clientWidth };
    });
    expect(overflow.scroll, `${module} 页面横向溢出`).toBeLessThanOrEqual(overflow.client);
  }
});
