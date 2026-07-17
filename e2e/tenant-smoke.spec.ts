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

  // 列表页:对账汇总条;逐合同对账明细已迁入详情页。
  await expect(page.getByText('合同-付款对账视图')).toBeVisible();
  await expect(page.getByText('待核差额')).toBeVisible();
  await page.getByRole('button', { name: '详情', exact: true }).first().click();
  // 合同信息页签(默认)含电子签章区:在线签章入口 + 签署留痕说明。
  await expect(page.getByText('电子签章', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /在线签章|重新签章/ })).toBeVisible();
  // 详情页按业务操作类型拆分 TAB:付款对账内容在「付款对账」页签下。
  await page.getByRole('button', { name: '付款对账' }).click();
  await expect(page.getByText('合同-付款对账', { exact: true })).toBeVisible();
  await expect(page.getByText(/合同付款登记覆盖/).first()).toBeVisible();
  await expect(page.getByText(/付款链路/).first()).toBeVisible();
});

test('付款批次为发票付款二级页,显示财务异常看板', async ({ page }) => {
  await page.goto('/?module=invoices');
  await page.getByRole('button', { name: /登录 \/ 注册/ }).click();
  await page.getByRole('button', { name: /登录系统/ }).click();
  await page.getByRole('button', { name: '付款批次', exact: true }).click();

  await expect(page.getByRole('button', { name: '返回发票台账' })).toBeVisible();
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
  // 付款批次已并入发票付款,不再是独立菜单。
  await expect(navButton(page, /付款批次/)).toHaveCount(0);
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

test('采购分析:KPI 与图表由后端真实聚合驱动', async ({ page }) => {
  await page.goto('/?module=analytics');
  await page.getByRole('button', { name: /登录 \/ 注册/ }).click();
  await page.getByRole('button', { name: /登录系统/ }).click();

  await expect(page.getByText('累计支出')).toBeVisible();
  await expect(page.getByText('月度支出趋势')).toBeVisible();
  await expect(page.getByText('品类支出占比')).toBeVisible();
  await expect(page.getByText('供应商支出排行')).toBeVisible();
  await expect(page.getByRole('button', { name: /导出报表/ })).toBeVisible();
  // 假数据元素已移除:虚构行情/虚构大额订单供应商不再出现。
  await expect(page.getByText('关键价格指标')).toHaveCount(0);
  await expect(page.getByText('中国石化')).toHaveCount(0);
  await expect(page.getByText('分享看板')).toHaveCount(0);
});
test('公开门户:供应商名录与平台公告页真实数据 + 二级详情', async ({ page }) => {
  // 未登录直达供应商名录(?page= 深链)。
  await page.goto('/?page=suppliers');
  await expect(page.getByRole('heading', { name: '供应商名录' })).toBeVisible();
  await expect(page.getByText('平台认证供应商公开名录 · 实时数据')).toBeVisible();
  // 真实数据卡片(demo 库至少有认证供应商)→ 点击进入二级详情。
  await page.getByText('查看公开信息 →').first().click();
  await expect(page.getByText('认证状态')).toBeVisible();
  await expect(page.getByRole('button', { name: '登录发起合作' })).toBeVisible();

  // 公告中心已并入「商机与公告」:深链 page=announcements 预选公告页签。
  await page.goto('/?page=announcements');
  await expect(page.getByRole('heading', { name: '商机与公告' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /公告中心/ })).toBeVisible();
  // 页签计数依赖环境数据(CI 干净库可能为 0),断言与计数解耦。
  await expect(page.locator('main').getByRole('button', { name: /^采购公告/ }).first()).toBeVisible();
  const procCards = page.locator('main button.w-full'); // 公告卡片(全宽按钮),排除页签
  if ((await procCards.count()) > 0) {
    await procCards.first().click();
    await expect(page.getByText('1. 公告正文')).toBeVisible();
    await expect(page.getByText('关键信息')).toBeVisible();
    await page.goBack().catch(() => {});
    await page.goto('/?page=announcements');
  }
  // 平台公告子页签:切换后列表(或空态)渲染。
  await page.locator('main').getByRole('button', { name: /^平台公告/ }).click();
  await expect(page.getByRole('heading', { name: '商机与公告' })).toBeVisible();
});
test('商机大厅:公开列表 + 详情 + 报名参与', async ({ page }) => {
  await page.goto('/?page=opportunities');
  await expect(page.getByRole('heading', { name: '商机与公告' })).toBeVisible();
  // 合并页:公告中心页签恒定;方式页签(询比/竞价/招标)按环境数据动态出现,不硬断言。
  await expect(page.getByRole('tab', { name: /公告中心/ })).toBeVisible();
  // 新版布局:方式页签 + 搜索按钮 + 物资分类筛选 + 行式列表(预算金额)。
  await expect(page.getByRole('tab', { name: /全部商机/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '搜索' })).toBeVisible();
  await expect(page.getByText('物资分类:')).toBeVisible();
  await expect(page.getByText('预算金额').first()).toBeVisible();
  // 进入一个报名期内的商机详情。
  await page.locator('main').getByText('报名与报价中').first().click();
  await expect(page.getByText('返回大厅')).toBeVisible();
  await expect(page.getByText('1. 采购内容与报价要求')).toBeVisible();
  await expect(page.getByText('项目关键信息')).toBeVisible();
  // 立即报名展开表单。
  await page.getByRole('button', { name: /立即报名/ }).click();
  // 报名登记(公司名带时间戳避免重复报名守卫)。
  await page.getByPlaceholder('与营业执照一致的企业全称').fill(`E2E报名企业${Date.now()}`);
  await page.getByPlaceholder('姓名').fill('测试联系人');
  await page.getByPlaceholder('手机 / 座机').fill('13900000000');
  await page.getByRole('button', { name: /提交报名/ }).click();
  await expect(page.getByText('报名已提交')).toBeVisible();
});
test('智能审批:审批节点配置面板(可配置+财务节点固定开启)', async ({ page }) => {
  await page.goto('/?module=approvals');
  await page.getByRole('button', { name: /登录 \/ 注册/ }).click();
  await page.getByRole('button', { name: /登录系统/ }).click();

  // 入口在标题栏右上角,点击展开配置面板。
  await page.getByRole('button', { name: '审批节点配置' }).click();
  await expect(page.getByText(/审批人与流转规则由审批引擎/)).toBeVisible();
  // 七个节点渲染,财务节点带固定开启锁。
  await expect(page.getByRole('switch').first()).toBeVisible();
  await expect(page.getByText('固定开启').first()).toBeVisible();
  await expect(page.getByText('需求审批', { exact: true })).toBeVisible();
});
test('门户供应商入驻:注册入口 + 申请表单 + 提交成功', async ({ page }) => {
  await page.goto('/?page=supplier-register');
  await expect(page.getByRole('heading', { name: '供应商入驻申请' })).toBeVisible();
  await expect(page.getByText('入驻流程')).toBeVisible();
  await expect(page.getByText('平台初审')).toBeVisible();
  // 提交真实申请(名称带时间戳防重名守卫)。
  await page.getByPlaceholder('与营业执照一致的企业全称').fill(`E2E入驻企业${Date.now()}`);
  await page.getByPlaceholder('如:机电设备').fill('测试行业');
  await page.getByPlaceholder('91xxxxxxxxxxxxxxxx').fill('91310000E2E00001');
  const fields = page.locator('main input');
  await fields.nth(3).fill('测试法人');
  await fields.nth(4).fill('测试联系人');
  await fields.nth(5).fill('13500000000');
  await fields.nth(6).fill('e2e@reg.example.com');
  await page.getByRole('button', { name: /提交入驻申请/ }).click();
  await expect(page.getByText('入驻申请已提交')).toBeVisible();
});

test('收货验收工作台:双页签 + 验收登记独立页', async ({ page }) => {
  await loginAsBuyer(page);
  await navButton(page, /收货验收/).click();
  await expect(page.getByRole('heading', { name: '收货验收', level: 3 })).toBeVisible();
  await expect(page.getByText('待验收订单')).toBeVisible();
  await expect(page.getByText('累计合格率')).toBeVisible();

  // 验收登记独立页(有待验收数据时)
  // ResponsiveTableFrame 移动卡片里有同名隐藏按钮,限定桌面表格作用域。
  const receiveBtn = page.locator('table').getByRole('button', { name: '验收登记' });
  if ((await receiveBtn.count()) > 0) {
    await receiveBtn.first().click();
    await expect(page.getByRole('heading', { name: '数量核对' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '质检结论' })).toBeVisible();
    await expect(page.getByRole('button', { name: /提交验收/ })).toBeVisible();
    await page.getByRole('button', { name: '返回待验收列表' }).click();
  }
  // 验收记录页签
  await page.getByRole('tab', { name: /验收记录/ }).click();
  await expect(page.getByRole('heading', { name: '收货验收', level: 3 })).toBeVisible();
});

test('竞价采购:台账 + 竞价台(实时出价流/排行榜/趋势)', async ({ page }) => {
  await loginAsBuyer(page);
  await navButton(page, /竞价采购/).click();
  await expect(page.getByRole('heading', { name: '竞价采购', level: 3 })).toBeVisible();
  await expect(page.getByText('竞价进行中')).toBeVisible();
  await expect(page.getByRole('button', { name: /发起竞价立项/ })).toBeVisible();

  const detailBtn = page.locator('table').getByRole('button', { name: '查看详情' });
  if ((await detailBtn.count()) > 0) {
    await detailBtn.first().click();
    await expect(page.getByText('实时出价流')).toBeVisible();
    await expect(page.getByText('实时竞价排行榜')).toBeVisible();
    await expect(page.getByText('价格趋势图')).toBeVisible();
    await expect(page.getByText('Current Lowest')).toBeVisible();
    await page.getByRole('button', { name: '返回竞价列表' }).click();
    await expect(page.getByRole('heading', { name: '竞价采购', level: 3 })).toBeVisible();
  }
});
