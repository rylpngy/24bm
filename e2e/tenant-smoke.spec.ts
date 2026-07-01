import { expect, test, type Page } from '@playwright/test';
import { loginViaKeycloak } from './helpers';

// 采购方端冒烟:登录 → 工作台 → 供应商库(SRM)→ 供应商列表(表头/序号/分页)→ 采购需求。
// 覆盖真实链路:Keycloak 登录 + 真数据列表渲染 + 统一工具条。

async function loginAsBuyer(page: Page) {
  await loginViaKeycloak(page);
  // 登录成功后左侧出现全局导航。
  await expect(page.getByRole('button', { name: /供应商库/ })).toBeVisible();
}

test('未登录访问采购方端展示公开门户首页', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /数据驱动的\s*智慧供应链生态/ })).toBeVisible();
  await expect(page.getByPlaceholder(/采购品目|项目名称|供应商/)).toBeVisible();
  await expect(page.getByText('智采云平台生态')).toBeVisible();
  await expect(page.getByText('入驻采购业主')).toBeVisible();
  await expect(page.getByText('最新商机')).toBeVisible();
  await expect(page.getByText('优质供应商')).toBeVisible();
  await expect(page.getByRole('button', { name: /登录 \/ 注册/ })).toBeVisible();
});

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
  await page.getByRole('button', { name: /登录 \/ 注册/ }).click();
  await page.getByRole('button', { name: /Keycloak 登录/ }).click();

  await expect(page.getByText('合同-付款对账视图')).toBeVisible();
  await expect(page.getByText('待核差额')).toBeVisible();
  await expect(page.getByRole('button', { name: /存在付款阻断/ })).toBeVisible();
  await expect(page.getByText(/合同付款登记覆盖/).first()).toBeVisible();
  await expect(page.getByText(/付款链路/).first()).toBeVisible();
});

test('付款批次页显示财务异常看板', async ({ page }) => {
  await page.goto('/?module=payment-batches');
  await page.getByRole('button', { name: /登录 \/ 注册/ }).click();
  await page.getByRole('button', { name: /Keycloak 登录/ }).click();

  await expect(page.getByText('财务异常看板')).toBeVisible();
  await expect(page.getByText('待处理异常')).toBeVisible();
  await expect(page.getByText('阻断金额')).toBeVisible();
  await expect(page.getByRole('button', { name: /^全部 \d+/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^付款阻断 \d+/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^差异待处理 \d+/ })).toBeVisible();
  await expect(page.getByText('执行记录明细').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /登记付款/ }).first()).toBeVisible();
});

test('采购申请员仅显示需求与寻源相关菜单', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /登录 \/ 注册/ }).click();
  await page.getByRole('button', { name: /以采购申请员登录/ }).click();

  await expect(page.getByRole('button', { name: /采购需求/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /询价项目/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /物料目录/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /合同管理/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /付款批次/ })).toHaveCount(0);
});

test('财务专员显示合同与付款菜单但不显示采购需求', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /登录 \/ 注册/ }).click();
  await page.getByRole('button', { name: /以财务专员登录/ }).click();

  await expect(page.getByRole('button', { name: /合同管理/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /发票付款/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /付款批次/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /采购需求/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /团队与权限/ })).toHaveCount(0);
});
