import { expect, test, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:8080/api/v1';

async function tokens(request: APIRequestContext) {
  const buyer = (await (await request.post(`${API}/auth/login`, {
    data: { account: 'buyer.owner@example.com', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-acme' },
  })).json()).data.accessToken as string;
  const supplier = (await (await request.post(`${API}/auth/login`, {
    data: { account: 'supplier.sales@example.com', password: 'demo123456', scope: 'SUPPLIER', supplierId: 'ent-supplier-sunrise' },
  })).json()).data.accessToken as string;
  return { buy: { Authorization: `Bearer ${buyer}` }, sup: { Authorization: `Bearer ${supplier}` } };
}

// M-4 行为级:供应商提审 → 采购方驳回(带意见)→ 复审通过上架。
test('上架审核:供应商不能自行上架,驳回后可补正复审', async ({ request }) => {
  const { buy, sup } = await tokens(request);
  const name = `审核商品-${Date.now()}`;
  const productId = (await (await request.post(`${API}/supplier/mall/products`, {
    headers: sup, data: { tenantId: 'tenant-acme', name },
  })).json()).data.id as string;
  await request.post(`${API}/supplier/mall/products/${productId}/skus`, {
    headers: sup, data: { unit: '个', price: 60 },
  });

  // 供应商直接上架被拒——否则审核形同虚设。
  const selfPublish = await request.put(`${API}/supplier/mall/products/${productId}/status`, {
    headers: sup, data: { status: '在架' },
  });
  expect(selfPublish.ok()).toBeFalsy();
  expect(await selfPublish.text()).toContain('审核');

  await request.put(`${API}/supplier/mall/products/${productId}/status`, {
    headers: sup, data: { status: '待审核' },
  });
  const pending = await (await request.get(`${API}/buyer/mall/products/pending-review`, { headers: buy })).json();
  expect((pending.data as Array<{ name: string }>).some((p) => p.name === name)).toBe(true);

  // 驳回必须带意见,驳回后退回草稿。
  const noComment = await request.post(`${API}/buyer/mall/products/${productId}/review`, {
    headers: buy, data: { approved: false, comment: '' },
  });
  expect(noComment.ok()).toBeFalsy();
  const rejected = await request.post(`${API}/buyer/mall/products/${productId}/review`, {
    headers: buy, data: { approved: false, comment: '规格描述不全' },
  });
  expect((await rejected.json()).data.status).toBe('草稿');

  // 补正后复审通过 → 在架。
  await request.put(`${API}/supplier/mall/products/${productId}/status`, {
    headers: sup, data: { status: '待审核' },
  });
  const approved = await request.post(`${API}/buyer/mall/products/${productId}/review`, {
    headers: buy, data: { approved: true, comment: '已补齐,准予上架' },
  });
  expect((await approved.json()).data.status).toBe('在架');
});

// M-4 行为级:已收货订单行 → 申请售后 → 供应商处理 → 评价一次。
test('售后与评价:发货后可申请售后,收货后可评价且只能评一次', async ({ request }) => {
  const { buy } = await tokens(request);
  const orders = (await (await request.get(`${API}/buyer/orders`, { headers: buy })).json()).data as
    Array<{ id: string; status: string; supplierId: string; lineItems?: Array<{ id: string; quantity: number }> }>;
  const received = orders.find((o) => o.status === '已收货' && (o.lineItems ?? []).length > 0);
  test.skip(!received, '演示库缺少已收货订单,跳过售后/评价链路');
  const line = received!.lineItems![0];

  // 类型与数量都由服务端把关。
  const badType = await request.post(`${API}/buyer/mall/after-sales`, {
    headers: buy,
    data: { orderId: received!.id, orderLineId: line.id, type: '退款', quantity: 1, reason: '测试' },
  });
  expect(badType.ok()).toBeFalsy();
  const tooMany = await request.post(`${API}/buyer/mall/after-sales`, {
    headers: buy,
    data: { orderId: received!.id, orderLineId: line.id, type: '退货', quantity: line.quantity + 1, reason: '测试' },
  });
  expect(tooMany.ok()).toBeFalsy();
  expect(await tooMany.text()).toContain('超过订购数量');

  const applied = await request.post(`${API}/buyer/mall/after-sales`, {
    headers: buy,
    data: { orderId: received!.id, orderLineId: line.id, type: '维修', quantity: 1, reason: 'E2E 到货异响' },
  });
  expect(applied.ok()).toBeTruthy();

  // 供应商侧处理:拒绝必须给理由。
  const supplierToken = (await (await request.post(`${API}/auth/login`, {
    data: { account: 'supplier.sales@example.com', password: 'demo123456', scope: 'SUPPLIER', supplierId: received!.supplierId },
  })).json()).data?.accessToken as string | undefined;
  if (supplierToken) {
    const supHeaders = { Authorization: `Bearer ${supplierToken}` };
    const list = (await (await request.get(`${API}/supplier/mall/after-sales`, { headers: supHeaders })).json()).data as
      Array<{ id: string; status: string; reason: string }>;
    const mine = list.find((a) => a.reason === 'E2E 到货异响');
    expect(mine?.status).toBe('待处理');
    const rejectWithoutReply = await request.put(`${API}/supplier/mall/after-sales/${mine!.id}`, {
      headers: supHeaders, data: { status: '已拒绝' },
    });
    expect(rejectWithoutReply.ok()).toBeFalsy();
    const handled = await request.put(`${API}/supplier/mall/after-sales/${mine!.id}`, {
      headers: supHeaders, data: { status: '已完成', reply: 'E2E 已上门维修' },
    });
    expect(handled.ok()).toBeTruthy();
  }

  // 评价:同一订单行只能评一次。
  const first = await request.post(`${API}/buyer/mall/reviews`, {
    headers: buy, data: { orderId: received!.id, orderLineId: line.id, rating: 4, content: 'E2E 评价' },
  });
  const second = await request.post(`${API}/buyer/mall/reviews`, {
    headers: buy, data: { orderId: received!.id, orderLineId: line.id, rating: 1, content: 'E2E 重复' },
  });
  // 首次可能因历史数据已评而失败,但「重复评价被拒」这条恒成立。
  expect(second.ok()).toBeFalsy();
  expect(await second.text()).toContain('已评价过');
  if (first.ok()) {
    const reviews = (await (await request.get(`${API}/buyer/mall/reviews`, { headers: buy })).json()).data as
      Array<{ content: string }>;
    expect(reviews.some((r) => r.content === 'E2E 评价')).toBe(true);
  }
});
