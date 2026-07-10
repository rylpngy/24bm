import { expect, test } from '@playwright/test';
import { loginViaKeycloak, openModule, expectLoggedIn } from './helpers';

// 采购主链路深 E2E:登录后沿 需求 → 询比 → 报价对比 → 采购订单 → 发票付款 逐站走,
// 断言每一站的关键业务内容(真后端 demo 数据已在各阶段铺好),确保整条链路任一环断裂都能被发现。
test('采购主链路逐站渲染(需求→询比→报价对比→订单→发票)', async ({ page }) => {
  await loginViaKeycloak(page);
  await expectLoggedIn(page, /供应商库/);

  // ① 采购需求:存在「已通过」需求 + 序号列。
  await openModule(page, /采购需求/);
  await expect(page.getByRole('columnheader', { name: '序号' })).toBeVisible();
  await expect(page.getByText('已通过').first()).toBeVisible();

  // ② 询比项目:项目列表(阶段徽章)→ 进入详情,报价对比是流程中的「定标决策」环节。
  await openModule(page, /询比项目/);
  await expect(page.getByText(/共\s*\d+\s*条/).first()).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '项目阶段' })).toBeVisible();

  // ③ 项目详情:五阶段步进器 + 供应商参与进度;已开标项目内嵌报价对比与定标入口。
  await page.getByRole('button', { name: '查看详情' }).first().click();
  await expect(page.getByText('定标决策').first()).toBeVisible();
  await expect(page.getByText('供应商参与进度')).toBeVisible();

  // ④ 采购订单:订单行项明细(源自中标报价)+ KPI。
  await openModule(page, /采购订单/);
  await expect(page.getByText('订单总数').first()).toBeVisible();
  await expect(page.getByText(/订单行项明细/).first()).toBeVisible();

  // ⑤ 发票付款:三单匹配(金额维度)。
  await openModule(page, /发票付款/);
  await expect(page.getByText(/三单匹配/).first()).toBeVisible();
  await expect(page.getByText('价税合计').first()).toBeVisible();
});
