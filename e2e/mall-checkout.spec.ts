import { expect, test, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:8080/api/v1';

async function seedProduct(request: APIRequestContext, name: string) {
  const supplier = (await (await request.post(`${API}/auth/login`, {
    data: { account: 'supplier.sales@example.com', password: 'demo123456', scope: 'SUPPLIER', supplierId: 'ent-supplier-sunrise' },
  })).json()).data.accessToken as string;
  const sup = { Authorization: `Bearer ${supplier}` };
  const productId = (await (await request.post(`${API}/supplier/mall/products`, {
    headers: sup, data: { tenantId: 'tenant-acme', name },
  })).json()).data.id as string;
  await request.post(`${API}/supplier/mall/products/${productId}/skus`, {
    headers: sup,
    data: { unit: '箱', price: 120, minOrderQty: 1, stepQty: 1, stockQty: 60, leadTimeDays: 6 },
  });
  await request.put(`${API}/supplier/mall/products/${productId}/status`, {
    headers: sup, data: { status: '在架' },
  });
  return productId;
}

// M-3b 行为级:门户内完成 加购 → 购物车改量 → 结算 → 下单成功 → 我的订单可见。
test('商城门户:购物车改量 → 结算下单 → 我的订单', async ({ page, request }) => {
  const name = `结算商品-${Date.now()}`;
  await seedProduct(request, name);

  await page.goto('/');
  await page.getByRole('button', { name: /以采购管理员登录/ }).click();
  await expect(page.getByRole('heading', { name: '企业采购商城' })).toBeVisible();

  // 搜索 → 详情 → 加购 3 箱。
  await page.getByPlaceholder(/搜索商品名称/).fill(name);
  await page.getByRole('button', { name: '搜索' }).first().click();
  await page.getByRole('button', { name: new RegExp(name) }).first().click();
  await page.getByRole('spinbutton').fill('3');
  await page.getByRole('button', { name: /加入购物车/ }).click();
  await expect(page.getByText(/已加入购物车/)).toBeVisible();

  // 购物车:行内 + 一次 → 4 箱 = ¥480。
  await page.getByRole('button', { name: /^购物车/ }).click();
  await expect(page.getByRole('heading', { name: '购物车' })).toBeVisible();
  // 步进按钮带 aria-label(纯 +/− 符号既难定位也不利于读屏)。
  await page.getByRole('button', { name: `增加 ${name} 数量` }).click();
  await expect(page.getByText('4 箱')).toBeVisible();
  await expect(page.getByText('¥480.00').first()).toBeVisible();

  // 结算:订单预览按供应商拆单,提交后给出成功页。
  await page.getByRole('button', { name: '去结算' }).click();
  await expect(page.getByRole('heading', { name: /订单预览/ })).toBeVisible();
  await page.getByRole('button', { name: '提交订单' }).last().click();
  await expect(page.getByRole('heading', { name: '下单成功' })).toBeVisible();
  await expect(page.getByText(/已生成 1 张采购订单/)).toBeVisible();

  // 我的订单:新订单在列,金额一致。
  await page.getByRole('button', { name: '查看我的订单' }).click();
  await expect(page.getByRole('heading', { name: /我的订单/ })).toBeVisible();
  await expect(page.getByText('¥480.00').first()).toBeVisible();

  // 购物车已清空。
  await page.getByRole('button', { name: /^购物车/ }).click();
  await expect(page.getByText('购物车是空的')).toBeVisible();
});
