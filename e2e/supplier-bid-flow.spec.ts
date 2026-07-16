import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { expectLoggedIn, loginViaKeycloak, openModule } from './helpers';

// 供应商投标行为级 E2E(P0-3):
// ① 清单报价 + 电子签署闭环:API 造一单唯一标题的直录询价(前置安排),供应商侧全 UI 走
//    清单驱动表格 → 填单价 → 签名画布手写 → 签署并提交 → 报价单回执 + 签署留痕。
// ② 开标 → 唱标大厅:种子询比 rfq-demo(截止已过)由买方开标(已开标则容忍跳过),
//    供应商侧断言开标大厅唱标表与「我方报价」行。
// 设计原则:每次运行用时间戳唯一标题(可重复执行);断言不依赖环境计数。

const API = 'http://localhost:8080/api/v1';

async function buyerToken(request: APIRequestContext) {
  const res = await request.post(`${API}/auth/login`, {
    data: { account: 'buyer.owner@example.com', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-acme' },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data.accessToken as string;
}

// 前置安排:直录立项(自带采购清单行)→ 邀请 sunrise → 发布。返回项目标题。
async function seedOpenRfq(request: APIRequestContext) {
  const token = await buyerToken(request);
  const title = `E2E签署报价-${Date.now()}`;
  const deadline = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
  const created = await request.post(`${API}/buyer/rfqs`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      deadlineAt: deadline,
      method: '询比',
      evaluationMethod: '最低价',
      saveAsDraft: true,
      directDepartmentId: 'dept-it',
      directBudget: 60000,
      directItems: [{ materialId: 'mat-monitor', quantity: 6 }],
    },
  });
  expect(created.ok()).toBeTruthy();
  const rfqId = (await created.json()).data.id as string;
  await request.put(`${API}/buyer/rfqs/${rfqId}/invitations`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { supplierIds: ['ent-supplier-sunrise'] },
  });
  const published = await request.post(`${API}/buyer/rfqs/${rfqId}/publish`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(published.ok()).toBeTruthy();
  return title;
}

// 签名画布:鼠标画一段折线笔迹。
async function drawSignature(page: Page) {
  const canvas = page.getByTestId('signature-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('signature canvas not visible');
  const x = box.x + 40;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 70, y - 18, { steps: 6 });
  await page.mouse.move(x + 140, y + 14, { steps: 6 });
  await page.mouse.up();
}

test('清单报价 + 电子签署:填单价 → 手写签名 → 签署并提交 → 回执与签署留痕', async ({ page, request }) => {
  const title = await seedOpenRfq(request);

  await loginViaKeycloak(page);
  await expectLoggedIn(page, /询价项目/);
  await openModule(page, /询价项目/);
  await expect(page.getByRole('heading', { name: '询价项目', level: 3 })).toBeVisible();
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '去报价' }).click();

  // 清单驱动表格:品名/数量只读(采购方给定),仅「我方单价」可填。
  await expect(page.getByRole('columnheader', { name: /采购清单行/ })).toBeVisible();
  await expect(page.getByText(/由采购方在采购清单中给定,不可修改/)).toBeVisible();
  const submit = page.getByRole('button', { name: /签署并提交报价/ });
  await expect(submit).toBeDisabled();

  await page.locator('input[aria-label$="单价"]').first().fill('1180');
  await expect(submit).toBeDisabled(); // 未签名仍禁用:询比报价必须电子签署
  await drawSignature(page);
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText(/报价已提交并完成电子签署/)).toBeVisible();
  // 报价单回执 + 电子签署留痕(签署人 + 内容指纹)。
  await expect(page.getByText('我的报价单')).toBeVisible();
  await expect(page.getByText('供应商签署')).toBeVisible();
  await expect(page.getByText(/指纹 [0-9a-f]{16}/)).toBeVisible();
});

test('开标 → 唱标:买方开标(容忍已开标),供应商开标大厅可见我方报价行', async ({ page, request }) => {
  // 买方开标走 API(rfq-demo 截止已过,无需 force;已开标则容忍)。
  const token = await buyerToken(request);
  await request.post(`${API}/buyer/rfqs/rfq-demo/open`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  }); // 已开标时后端拒绝,忽略结果——下方以供应商侧唱标为准。

  await loginViaKeycloak(page);
  await expectLoggedIn(page, /询价项目/);
  await openModule(page, /询价项目/);
  await page.getByPlaceholder(/按项目名称/).fill('办公电脑询价');
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: '办公电脑询价' }).first()
    .getByRole('button', { name: /开标大厅|查看项目|去报价/ }).click();
  await expect(page.getByText(/唱标记录/)).toBeVisible();
  await expect(page.getByText('我方报价')).toBeVisible();
  // 唱标只公开报价总额,他方身份匿名。
  await expect(page.getByText(/仅公开报价总额,他方身份与明细不披露/)).toBeVisible();
});
