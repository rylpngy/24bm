import { expect, test } from '@playwright/test';
import { loginViaKeycloak, openModule, expectLoggedIn } from './helpers';

// 平台运营端冒烟:登录 → 租户列表 / 企业审核 / 平台公告,断言统一工具条(计数)与关键操作入口。
test('平台端登录后可进入运营后台', async ({ page }) => {
  await loginViaKeycloak(page);
  await expectLoggedIn(page, /租户列表/);
  await expect(page.getByRole('button', { name: /企业审核/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /平台公告/ })).toBeVisible();
});

test('租户列表 / 企业审核 / 公告 渲染', async ({ page }) => {
  await loginViaKeycloak(page);

  await openModule(page, /租户列表/);
  await expect(page.getByRole('heading', { name: '租户列表', level: 3 })).toBeVisible();
  // 对齐采购端列表页:指标卡 + 分段筛选 + 序号表格 + 分页。
  await expect(page.getByText('入驻租户').first()).toBeVisible();
  await expect(page.getByRole('tab', { name: /已启用/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '序号' })).toBeVisible();
  await expect(page.getByText(/共\s*\d+\s*条/).first()).toBeVisible();

  await openModule(page, /企业审核/);
  await expect(page.getByRole('heading', { name: '企业审核', level: 3 })).toBeVisible();
  await expect(page.getByRole('tab', { name: /待初审/ })).toBeVisible();

  await openModule(page, /平台公告/);
  await expect(page.getByRole('heading', { name: '平台公告', level: 3 })).toBeVisible();
  // 发布入口(已统一为绿色主操作)。
  await expect(page.getByRole('button', { name: /发布公告/ })).toBeVisible();
});
