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

  // ② 询比项目:有询比记录(计数胶囊)。
  await openModule(page, /询比项目/);
  await expect(page.getByText(/共\s*\d+\s*条/).first()).toBeVisible();

  // ③ 报价对比:比价矩阵(含税总价列 + 定标入口)。
  await openModule(page, /报价对比/);
  await expect(page.getByText('含税总价').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '定标' }).first()).toBeVisible();

  // ④ 采购订单:订单行项明细(源自中标报价)+ KPI。
  await openModule(page, /采购订单/);
  await expect(page.getByText('订单总数').first()).toBeVisible();
  await expect(page.getByText(/订单行项明细/).first()).toBeVisible();

  // ⑤ 发票付款:三单匹配(金额维度)。
  await openModule(page, /发票付款/);
  await expect(page.getByText(/三单匹配/).first()).toBeVisible();
  await expect(page.getByText('价税合计').first()).toBeVisible();
});
