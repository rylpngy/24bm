import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectLoggedIn, loginViaKeycloak, navButton } from './helpers';

const API = 'http://localhost:8080/api/v1';

async function tokens(request: APIRequestContext) {
  const buyer = (await (await request.post(`${API}/auth/login`, {
    data: { account: 'buyer.owner@example.com', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-acme' },
  })).json()).data.accessToken as string;
  const supplier = (await (await request.post(`${API}/auth/login`, {
    data: { account: 'supplier.sales@example.com', password: 'demo123456', scope: 'SUPPLIER', supplierId: 'ent-supplier-sunrise' },
  })).json()).data.accessToken as string;
  return { buyer, supplier };
}

// 前置安排:API 造一单「报价中」的邀请竞价(唯一标题),供应商已受邀。
async function seedLiveAuction(request: APIRequestContext, buyer: string) {
  const department = await request.post(`${API}/buyer/departments`, {
    headers: { Authorization: `Bearer ${buyer}` },
    data: { name: `E2E竞价归口-${Date.now()}` },
  });
  expect(department.ok(), await department.text()).toBeTruthy();
  const departmentId = (await department.json()).data.id as string;
  const materials = (await (await request.get(`${API}/buyer/materials`, {
    headers: { Authorization: `Bearer ${buyer}` },
  })).json()).data as Array<{ id?: string }>;
  const title = `E2E实时竞价-${Date.now()}`;
  const created = await request.post(`${API}/buyer/rfqs`, {
    headers: { Authorization: `Bearer ${buyer}` },
    data: {
      title, method: '竞价',
      deadlineAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
      invitedSupplierIds: ['ent-supplier-sunrise'],
      auctionStartPrice: 200000, auctionMinDecrement: 1000,
      directDepartmentId: departmentId, directBudget: 200000,
      directItems: [{ materialId: materials[0]?.id, quantity: 2 }],
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  return { title, id: (await created.json()).data.id as string };
}

// G-1 行为级:进行中的竞价页建立 SSE 通道 → 供应商出价 → 采购端无需等待轮询即刷新最低价。
test('竞价实时推送:通道连接 → 出价即时反映在竞价台', async ({ page, request }) => {
  const { buyer, supplier } = await tokens(request);
  const { title, id } = await seedLiveAuction(request, buyer);

  await loginViaKeycloak(page);
  await expectLoggedIn(page, /竞价采购/);
  await navButton(page, /竞价采购/).click();
  await expect(page.getByRole('heading', { name: '竞价采购', level: 3 })).toBeVisible();
  // 有进行中竞价时建立通道;连接后徽标转为「已连接」。
  await expect(page.getByText('实时推送已连接')).toBeVisible({ timeout: 15_000 });

  // 供应商出价(API),采购端应由推送驱动刷新——不点任何按钮、不重载页面。
  const rfq = ((await (await request.get(`${API}/supplier/rfqs`, {
    headers: { Authorization: `Bearer ${supplier}` },
  })).json()).data as Array<{ id?: string; items?: Array<Record<string, unknown>> }>).find((r) => r.id === id);
  const lineItems = (rfq?.items ?? []).map((i) => ({
    description: i.materialName, unit: i.unit, quantity: i.quantity,
    unitPrice: 60000, demandItemId: i.demandItemId,
  }));
  // 进竞价台看当前最低价:出价前为「—」(尚无报价)。
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first()
    .getByRole('button', { name: '竞价台' }).click();
  await expect(page.getByText('实时出价流')).toBeVisible();

  const bid = await request.post(`${API}/supplier/rfqs/${id}/quotes`, {
    headers: { Authorization: `Bearer ${supplier}` },
    data: { amount: 120000, taxRate: 13, deliveryDays: 7, lineItems },
  });
  expect(bid.ok()).toBeTruthy();

  // 不点任何按钮、不重载:推送到达后当前最低价自动刷新。
  // 前置徽标已断言通道「已连接」,此时降级轮询是关闭的——刷新只可能来自服务端推送。
  await expect(page.getByText('¥120,000.00').first()).toBeVisible({ timeout: 15_000 });
});
