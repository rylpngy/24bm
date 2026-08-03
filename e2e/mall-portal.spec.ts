import { expect, test } from '@playwright/test';
import { approveProduct } from './helpers';

const API = 'http://localhost:8080/api/v1';

// 商城门户(M-3a):未登录看公开专区 → 登录 → 首页 → 分类筛选 → 详情阶梯价联动 → 加购。
test('商城门户:登录 → 首页 → 商品详情阶梯价联动 → 加入购物车', async ({ page, request }) => {
  // 造一个带阶梯价的在架商品,保证门户上有确定可断言的数据。
  const supplier = (await (await request.post(`${API}/auth/login`, {
    data: { account: 'supplier.sales@example.com', password: 'demo123456', scope: 'SUPPLIER', supplierId: 'ent-supplier-sunrise' },
  })).json()).data.accessToken as string;
  const sup = { Authorization: `Bearer ${supplier}` };
  const name = `门户商品-${Date.now()}`;
  const productId = (await (await request.post(`${API}/supplier/mall/products`, {
    headers: sup, data: { tenantId: 'tenant-acme', name, brand: '门户品牌' },
  })).json()).data.id as string;
  await request.post(`${API}/supplier/mall/products/${productId}/skus`, {
    headers: sup,
    data: {
      unit: '箱', price: 300, minOrderQty: 2, stepQty: 2, stockQty: 80, leadTimeDays: 4,
      tierPrices: [{ minQty: 10, price: 250 }],
    },
  });
  // M-4:供应商只能提审,上架由采购方审核通过。
  await request.put(`${API}/supplier/mall/products/${productId}/status`, {
    headers: sup, data: { status: '待审核' },
  });
  await approveProduct(request, productId);

  // 未登录:先看到公开专区与登录卡,而不是空白墙。
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '公开专区' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '登录采购账号' })).toBeVisible();

  await page.getByRole('button', { name: /以采购管理员登录/ }).click();
  await expect(page.getByRole('heading', { name: '企业采购商城' })).toBeVisible();
  await expect(page.getByText(/在架商品/)).toBeVisible();

  // 搜索进分类页,再进详情。
  await page.getByPlaceholder(/搜索商品名称/).fill(name);
  await page.getByRole('button', { name: '搜索' }).first().click();
  await expect(page.getByRole('heading', { name: new RegExp(`搜索「${name}」`) })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(name) }).first().click();

  // 详情:起订量/交期/库存来自 SKU;数量改到 10 时阶梯价落 250 档。
  await expect(page.getByRole('heading', { name })).toBeVisible();
  // exact:页面提示语里也含「起订量」三字,宽松匹配会撞 strict mode。
  await expect(page.getByText('起订量', { exact: true })).toBeVisible();
  await expect(page.getByText('承诺交期', { exact: true })).toBeVisible();
  const quantity = page.getByRole('spinbutton');
  await quantity.fill('10');
  await expect(page.getByText('¥2,500.00')).toBeVisible();

  // 加购:成功提示 + 顶栏角标出现。
  await page.getByRole('button', { name: /加入购物车/ }).click();
  await expect(page.getByText(/已加入购物车/)).toBeVisible();
  // ^ 锚定:顶栏按钮名为「购物车 N」,不锚定会同时匹配到「加入购物车」。
  await expect(page.getByRole('button', { name: /^购物车/ })).toContainText(/\d/);
});
