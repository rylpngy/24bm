import { expect, test } from '@playwright/test';
import { approveProduct } from './helpers';

const API = 'http://localhost:8080/api/v1';

// M-2 行为级:服务端购物车按当前阶梯价实时计价、失效行如实标注、结算以购物车为准并写收货信息。
test('服务端购物车:实时计价 + 失效行拦截 + 结算落收货信息', async ({ request }) => {
  const buyer = (await (await request.post(`${API}/auth/login`, {
    data: { account: 'buyer.owner@example.com', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-acme' },
  })).json()).data.accessToken as string;
  const supplier = (await (await request.post(`${API}/auth/login`, {
    data: { account: 'supplier.sales@example.com', password: 'demo123456', scope: 'SUPPLIER', supplierId: 'ent-supplier-sunrise' },
  })).json()).data.accessToken as string;
  const buy = { Authorization: `Bearer ${buyer}` };
  const sup = { Authorization: `Bearer ${supplier}` };

  // 造一个带阶梯价与起订量的商品。
  const productId = (await (await request.post(`${API}/supplier/mall/products`, {
    headers: sup, data: { tenantId: 'tenant-acme', name: `E2E购物车-${Date.now()}` },
  })).json()).data.id as string;
  await request.post(`${API}/supplier/mall/products/${productId}/skus`, {
    headers: sup,
    data: {
      unit: '箱', price: 100, minOrderQty: 2, stepQty: 2, stockQty: 50, leadTimeDays: 5,
      tierPrices: [{ minQty: 10, price: 90 }],
    },
  });
  // M-4:供应商只能提审,上架由采购方审核通过。
  await request.put(`${API}/supplier/mall/products/${productId}/status`, {
    headers: sup, data: { status: '待审核' },
  });
  await approveProduct(request, productId);
  const skuId = (await (await request.get(`${API}/buyer/mall/products/${productId}`, { headers: buy })).json())
    .data.skus[0].id as string;

  // 清掉可能的存量购物车,保证断言稳定。
  const existing = await (await request.get(`${API}/buyer/mall/cart`, { headers: buy })).json();
  for (const group of existing.data.groups ?? []) {
    for (const line of group.lines ?? []) {
      await request.delete(`${API}/buyer/mall/cart/items/${line.skuId}`, { headers: buy });
    }
  }

  // 加购 1(低于起订):行保留但标失效,整车不可结算——不是静默丢弃。
  let cart = await (await request.post(`${API}/buyer/mall/cart/items`, {
    headers: buy, data: { skuId, quantity: 1 },
  })).json();
  expect(cart.data.hasBlockedItems).toBe(true);
  expect(cart.data.groups[0].lines[0].blockedReason).toContain('起订');

  const blockedCheckout = await request.post(`${API}/buyer/mall/cart/checkout`, {
    headers: buy, data: {},
  });
  expect(blockedCheckout.ok()).toBeFalsy();

  // 改量 10:落 90 档,合计 900,恢复可结算。
  cart = await (await request.put(`${API}/buyer/mall/cart/items`, {
    headers: buy, data: { skuId, quantity: 10 },
  })).json();
  expect(cart.data.hasBlockedItems).toBe(false);
  expect(cart.data.groups[0].lines[0].unitPrice).toBe(90);
  expect(cart.data.total).toBe(900);

  // 地址簿:首个地址自动成为默认。
  const receiver = `E2E收货人-${Date.now()}`;
  const addresses = await (await request.post(`${API}/buyer/mall/addresses`, {
    headers: buy,
    data: { receiver, phone: '13900000000', province: '上海市', city: '上海市', district: '浦东新区', detail: 'E2E 路 1 号' },
  })).json();
  // 已存在默认地址时新增地址不抢默认(需显式指定),故结算时显式选用本次地址。
  expect(addresses.data.some((a: { isDefault: boolean }) => a.isDefault)).toBe(true);
  const addressId = (addresses.data as Array<{ id: string; receiver: string }>)
    .find((a) => a.receiver === receiver)?.id;

  // 结算:清单来自服务端购物车,成功后购物车清空。
  const checkout = await request.post(`${API}/buyer/mall/cart/checkout`, {
    headers: buy, data: { addressId },
  });
  expect(checkout.ok()).toBeTruthy();
  const orders = (await checkout.json()).data as Array<{ amount: number }>;
  expect(orders[0].amount).toBe(900);

  const emptied = await (await request.get(`${API}/buyer/mall/cart`, { headers: buy })).json();
  expect(emptied.data.itemCount).toBe(0);

  // 收货信息写到了订单上,且直辖市不重复拼「上海市上海市」。
  const orderList = await (await request.get(`${API}/buyer/orders`, { headers: buy })).json();
  const withAddress = (orderList.data as Array<{ deliveryAddress?: string; contactName?: string }>)
    .find((o) => o.contactName === receiver);
  expect(withAddress?.deliveryAddress).toBe('上海市浦东新区E2E 路 1 号');
});
