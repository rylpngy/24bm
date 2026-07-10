import { expect, test, type Page } from '@playwright/test';
import { loginViaKeycloak, navButton } from './helpers';

// 采购方端冒烟:登录 → 工作台 → 供应商库(SRM)→ 供应商列表(表头/序号/分页)→ 采购需求。
// 覆盖真实链路:Keycloak 登录 + 真数据列表渲染 + 统一工具条。

async function loginAsBuyer(page: Page) {
  await loginViaKeycloak(page);
  // 登录成功后左侧出现全局导航。
  await expect(navButton(page, /供应商库/)).toBeVisible();
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

test('门户登录入口展示分栏登录页面', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /登录 \/ 注册/ }).click();

  await expect(page.getByRole('heading', { name: /连接企业采购的\s*数字化未来/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible();
  await expect(page.getByRole('button', { name: '账号密码登录' })).toBeVisible();
  await expect(page.getByRole('button', { name: '手机验证码' })).toBeVisible();
  await expect(page.getByPlaceholder('请输入用户名或企业邮箱')).toBeVisible();
  await expect(page.getByPlaceholder('请输入密码')).toBeVisible();
  await expect(page.getByRole('button', { name: /登录系统/ })).toBeVisible();
});

test('采购方登录后可进入工作台', async ({ page }) => {
  await loginAsBuyer(page);
  await expect(navButton(page, /首页看板/)).toBeVisible();
  await expect(navButton(page, /采购需求/)).toBeVisible();
});

test('刷新页面后登录态保持(会话持久化)', async ({ page }) => {
  await loginAsBuyer(page);
  await page.reload();
  await expect(navButton(page, /供应商库/)).toBeVisible();
  await expect(page.getByRole('button', { name: /登录 \/ 注册/ })).toHaveCount(0);
});

test('供应商库列表:工具条 + 序号 + 分页', async ({ page }) => {
  await loginAsBuyer(page);
  await navButton(page, /供应商库/).click();

  // SRM 工作台二级导航 + 供应商列表(默认页)表头含序号。
  await expect(page.getByRole('columnheader', { name: '序号' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '供应商' })).toBeVisible();
  // 统一工具条:搜索框 + 分页计数。
  await expect(page.getByPlaceholder(/搜索/).first()).toBeVisible();
  await expect(page.getByText(/共\s*\d+\s*条/)).toBeVisible();
});

test('采购需求列表:序号列 + 搜索', async ({ page }) => {
  await loginAsBuyer(page);
  await navButton(page, /采购需求/).click();

  await expect(page.getByRole('columnheader', { name: '序号' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '标题' })).toBeVisible();
  await expect(page.getByPlaceholder(/搜索/).first()).toBeVisible();
});

test('合同页显示合同-付款对账视图', async ({ page }) => {
  await page.goto('/?module=contracts');
  await page.getByRole('button', { name: /登录 \/ 注册/ }).click();
  await page.getByRole('button', { name: /登录系统/ }).click();

  await expect(page.getByText('合同-付款对账视图')).toBeVisible();
  await expect(page.getByText('待核差额')).toBeVisible();
  await expect(page.getByRole('button', { name: /存在付款阻断/ })).toBeVisible();
  await expect(page.getByText(/合同付款登记覆盖/).first()).toBeVisible();
  await expect(page.getByText(/付款链路/).first()).toBeVisible();
});

test('付款批次页显示财务异常看板', async ({ page }) => {
  await page.goto('/?module=payment-batches');
  await page.getByRole('button', { name: /登录 \/ 注册/ }).click();
  await page.getByRole('button', { name: /登录系统/ }).click();

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

  await expect(navButton(page, /采购需求/)).toBeVisible();
  await expect(navButton(page, /询比项目/)).toBeVisible();
  await expect(navButton(page, /物料目录/)).toBeVisible();
  await expect(navButton(page, /合同管理/)).toHaveCount(0);
  await expect(navButton(page, /付款批次/)).toHaveCount(0);
});

test('财务专员显示合同与付款菜单但不显示采购需求', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /登录 \/ 注册/ }).click();
  await page.getByRole('button', { name: /以财务专员登录/ }).click();

  await expect(navButton(page, /合同管理/)).toBeVisible();
  await expect(navButton(page, /发票付款/)).toBeVisible();
  await expect(navButton(page, /付款批次/)).toBeVisible();
  await expect(navButton(page, /采购需求/)).toHaveCount(0);
  await expect(navButton(page, /团队与权限/)).toHaveCount(0);
});

test('采购计划详情:进度节点与合规检查由真实数据驱动', async ({ page }) => {
  await page.goto('/?module=procurement-plans');
  await page.getByRole('button', { name: /登录 \/ 注册/ }).click();
  await page.getByRole('button', { name: /登录系统/ }).click();

  await page.getByRole('button', { name: '查看详情' }).first().click();
  await expect(page.getByText('执行进度跟踪')).toBeVisible();
  await expect(page.getByText('方案合规检查')).toBeVisible();
  await expect(page.getByText('审批流转')).toBeVisible();
  await expect(page.getByText('报价征集')).toBeVisible();
  // 假数据元素已移除:不再出现虚构审批人。
  await expect(page.getByText('王总监')).toHaveCount(0);
  await expect(page.getByText('AI 风险雷达')).toHaveCount(0);
});

test('需求详情:合并助手真实扫描,预算核对基于参考价', async ({ page }) => {
  await page.goto('/?module=demands');
  await page.getByRole('button', { name: /登录 \/ 注册/ }).click();
  await page.getByRole('button', { name: /登录系统/ }).click();

  await page.getByRole('button', { name: /详情/ }).first().click();
  await expect(page.getByText('需求合并助手')).toBeVisible();
  await expect(page.getByText('AI 需求助手')).toHaveCount(0);
  await page.getByRole('button', { name: '扫描可合并需求' }).click();
  // 真实扫描:要么给出候选(可在采购计划中合并),要么诚实的空态。
  await expect(
    page.getByText(/可在「采购计划」中合并立项|未发现可合并的已通过需求/).first(),
  ).toBeVisible();
});

