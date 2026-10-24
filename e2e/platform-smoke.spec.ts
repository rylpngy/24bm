import { expect, test } from '@playwright/test';
import { loginViaKeycloak, openModule, expectLoggedIn } from './helpers';

// 平台运营端冒烟:登录 → 租户列表 / 企业审核 / 平台公告,断言统一工具条(计数)与关键操作入口。
test('平台端登录后可进入运营后台', async ({ page }) => {
  await loginViaKeycloak(page);
  await expectLoggedIn(page, /租户列表/);
  await expect(page.getByRole('button', { name: /企业审核/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /平台公告/ })).toBeVisible();
});

// D-1 平台经营看板:跨租户聚合指标与图表恒定渲染(数值随环境,不硬断言)。
test('平台工作台:经营看板指标与趋势/方式分布', async ({ page }) => {
  await loginViaKeycloak(page);
  await expectLoggedIn(page, /租户列表/);
  await expect(page.getByText('累计交易额')).toBeVisible();
  await expect(page.getByText('近 30 天成交')).toBeVisible();
  await expect(page.getByText('活跃租户')).toBeVisible();
  await expect(page.getByText('认证供应商')).toBeVisible();
  await expect(page.getByRole('heading', { name: '近 6 个月成交趋势' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '采购方式分布' })).toBeVisible();
});

// D-3 供应商信用画像:榜单恒定渲染 + 进入画像详情(数值随环境,不硬断言)。
test('供应商信用:信用榜与画像详情', async ({ page }) => {
  await loginViaKeycloak(page);
  await expectLoggedIn(page, /租户列表/);
  await openModule(page, /供应商信用/);
  await expect(page.getByRole('heading', { name: '供应商信用', level: 3 })).toBeVisible();
  await expect(page.getByText('平均信用分')).toBeVisible();
  await expect(page.getByRole('tab', { name: /全部/ })).toBeVisible();
  const rows = page.locator('table tbody tr');
  if ((await rows.count()) > 0) {
    await rows.first().getByRole('button', { name: '画像' }).click();
    await expect(page.getByRole('heading', { name: '信用分构成' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '履约表现' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '结算合规' })).toBeVisible();
  }
});

// D-4 固定业务代码不可扩展，既有条目的名称与排序仍可维护。
test('运营配置:字典类型与条目维护', async ({ page }) => {
  await loginViaKeycloak(page);
  await expectLoggedIn(page, /租户列表/);
  await openModule(page, /运营配置/);
  await expect(page.getByRole('heading', { name: '运营配置', level: 3 })).toBeVisible();
  await expect(page.getByText('字典类型').first()).toBeVisible();
  await expect(page.getByText('条目总数')).toBeVisible();
  await page.getByRole('button', { name: /公告受众.*announcement_audience/ }).click();
  await expect(page.getByRole('button', { name: /新增条目/ })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '编码' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '名称-buyer', exact: true })).toBeEditable();
  await expect(page.getByRole('spinbutton', { name: '排序-buyer', exact: true })).toBeEditable();
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
  await expect(page.getByRole('button', { name: /开通新企业/ })).toBeVisible();

  await openModule(page, /企业审核/);
  // 对齐智能审批样式:标题卡 + 汇总卡 + 筛选工具条。
  await expect(page.getByRole('heading', { name: '企业审核中心' })).toBeVisible();
  await expect(page.getByText('在审企业').first()).toBeVisible();
  await expect(page.getByRole('combobox').first()).toBeVisible();

  await openModule(page, /平台公告/);
  await expect(page.getByRole('heading', { name: '平台公告', level: 3 })).toBeVisible();
  // 发布入口(已统一为绿色主操作)。
  await expect(page.getByRole('button', { name: /发布公告/ })).toBeVisible();
});
