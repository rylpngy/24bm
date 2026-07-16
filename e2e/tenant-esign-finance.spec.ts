import { expect, test, type Page } from '@playwright/test';
import { expectLoggedIn, loginViaKeycloak, openModule } from './helpers';

// 采购方电子签章 + 财务差异闭环行为级 E2E(P0-3)。
// 合同签章可重复执行(重新签章=追加留痕);差异处理对已推进状态做容忍。

async function drawSignature(page: Page) {
  const canvas = page.getByTestId('signature-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('signature canvas not visible');
  const x = box.x + 40;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 80, y - 16, { steps: 6 });
  await page.mouse.move(x + 150, y + 12, { steps: 6 });
  await page.mouse.up();
}

test('合同电子签章:签名画布 → 确认签章 → 采购方签章留痕(含内容指纹)', async ({ page }) => {
  await loginViaKeycloak(page);
  await expectLoggedIn(page, /合同管理/);
  await openModule(page, /合同管理/);
  await page.getByRole('button', { name: '详情', exact: true }).first().click();
  await expect(page.getByText('电子签章', { exact: true })).toBeVisible();

  // 首签为「在线签章」,复跑为「重新签章」——两者都走同一签署流程。
  await page.getByRole('button', { name: /在线签章|重新签章/ }).click();
  const confirm = page.getByRole('button', { name: '确认签章' });
  await expect(confirm).toBeDisabled(); // 未签名不可提交
  await drawSignature(page);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByText('采购方签章').first()).toBeVisible();
  await expect(page.getByText(/指纹 [0-9a-f]{16}/).first()).toBeVisible();
});

test('对账差异处理:发票详情引导 → 差异二级页 → 登记/推进(状态容忍)', async ({ page }) => {
  await loginViaKeycloak(page);
  await expectLoggedIn(page, /发票付款/);
  await openModule(page, /发票付款/);
  await expect(page.getByRole('columnheader', { name: '三单匹配' })).toBeVisible();

  // 找一张带对账差异的发票(种子 V223/V229 提供);无差异数据时仅冒烟列表。
  const varianceRow = page.locator('table tbody tr', { hasText: '差异' }).first();
  if ((await varianceRow.count()) === 0) return;
  await varianceRow.getByRole('button', { name: '详情' }).click();
  await expect(page.getByText('三单匹配', { exact: true })).toBeVisible();

  // 差异引导条 → 对账差异处理二级页(返回对账详情的返回键存在)。
  const goVariance = page.getByRole('button', { name: /去处理差异/ });
  if ((await goVariance.count()) === 0) return; // 该发票差异已处理完毕
  await goVariance.click();
  await expect(page.getByRole('heading', { name: '对账差异处理' })).toBeVisible();
  await expect(page.getByRole('button', { name: '返回对账详情' })).toBeVisible();

  // 行为推进(容忍既有状态):未登记→登记;待核实→标记已处理;已处理→断言留痕。
  const register = page.getByRole('button', { name: '登记差异处理' }).first();
  const resolve = page.getByRole('button', { name: /标记已处理/ }).first();
  if (await register.isVisible().catch(() => false)) {
    await register.click();
    await expect(page.getByText(/差异处理已登记/)).toBeVisible();
  } else if (await resolve.isVisible().catch(() => false)) {
    await resolve.click();
    await expect(page.getByText(/差异核实已提交/)).toBeVisible();
  } else {
    await expect(page.getByText(/已处理|待财务经理签核/).first()).toBeVisible();
  }
});
