import { expect, test, type APIRequestContext } from '@playwright/test';
import { approveProduct } from './helpers';

const API = 'http://localhost:8080/api/v1';

// M-1 行为级:供应商建商品 → 加规格(起订量/步进/库存/阶梯价)→ 上架 → 采购方按规则下单。
test('商城商品域:阶梯价与起订量在服务端生效', async ({ request }) => {
  const buyer = (await (await request.post(`${API}/auth/login`, {
    data: { account: 'buyer.owner@example.com', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-acme' },
  })).json()).data.accessToken as string;
  const supplier = (await (await request.post(`${API}/auth/login`, {
    data: { account: 'supplier.sales@example.com', password: 'demo123456', scope: 'SUPPLIER', supplierId: 'ent-supplier-sunrise' },
  })).json()).data.accessToken as string;
  const sup = { Authorization: `Bearer ${supplier}` };
  const buy = { Authorization: `Bearer ${buyer}` };

  const created = await request.post(`${API}/supplier/mall/products`, {
    headers: sup,
    data: { tenantId: 'tenant-acme', name: `E2E商品-${Date.now()}`, brand: 'E2E' },
  });
  expect(created.ok()).toBeTruthy();
  const productId = (await created.json()).data.id as string;
  // 新建即草稿:未加规格不得提交审核。
  const tooEarly = await request.put(`${API}/supplier/mall/products/${productId}/status`, {
    headers: sup, data: { status: '待审核' },
  });
  expect(tooEarly.ok()).toBeFalsy();

  expect((await request.post(`${API}/supplier/mall/products/${productId}/skus`, {
    headers: sup,
    data: {
      skuCode: 'E2E-01', unit: '箱', price: 200, minOrderQty: 2, stepQty: 2,
      stockQty: 40, leadTimeDays: 3,
      tierPrices: [{ minQty: 10, price: 180 }],
    },
  })).ok()).toBeTruthy();
  // M-4:供应商只能提审,上架由采购方审核通过。
  await request.put(`${API}/supplier/mall/products/${productId}/status`, {
    headers: sup, data: { status: '待审核' },
  });
  await approveProduct(request, productId);

  const detail = await (await request.get(`${API}/buyer/mall/products/${productId}`, { headers: buy })).json();
  const skuId = detail.data.skus[0].id as string;

  // 起订量 / 步进 / 库存:服务端拒绝,不靠前端拦。
  // 注:1000 是「合步进但超库存」,999 会先撞步进校验——校验顺序:起订 → 步进 → 库存。
  for (const [quantity, hint] of [[1, '起订'], [3, '整数倍'], [1000, '库存不足']] as const) {
    const rejected = await request.post(`${API}/buyer/mall/orders`, {
      headers: buy, data: { listingId: skuId, quantity, idempotencyKey: crypto.randomUUID() },
    });
    expect(rejected.ok(), `数量 ${quantity} 应被拒绝`).toBeFalsy();
    expect(await rejected.text()).toContain(hint);
  }

  // 阶梯价:10 箱落 180 档,金额由服务端重算(前端传什么价都不影响)。
  const ordered = await request.post(`${API}/buyer/mall/orders`, {
    headers: buy, data: { listingId: skuId, quantity: 10, idempotencyKey: crypto.randomUUID() },
  });
  expect(ordered.ok()).toBeTruthy();
  expect((await ordered.json()).data.amount).toBe(1800);

  // 下单后库存扣减 40 → 30。
  const after = await (await request.get(`${API}/buyer/mall/products/${productId}`, { headers: buy })).json();
  expect(after.data.skus[0].stockQty).toBe(30);
});
