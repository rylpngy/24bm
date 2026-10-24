import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectLoggedIn, loginViaKeycloak } from './helpers';

const API = process.env.E2E_API_BASE ?? 'http://localhost:8080/api/v1';
const KEYCLOAK = 'http://localhost:8081';
const TENANT = 'tenant-acme';
const FULL_FEATURES = ['rfq', 'order', 'finance', 'contract', 'mall'];

// 平台管理员只能走 Keycloak(该账号无自研登录口令),方式开关是平台侧动作。
async function platformToken(request: APIRequestContext) {
  const res = await request.post(
    `${KEYCLOAK}/realms/24bid/protocol/openid-connect/token`,
    {
      form: {
        grant_type: 'password',
        client_id: '24bid-portal',
        username: 'platform.admin@example.com',
        password: 'demo123456',
      },
    },
  );
  expect(res.ok(), 'Keycloak 密码模式取平台令牌失败').toBeTruthy();
  return (await res.json()).access_token as string;
}

async function setFeatures(request: APIRequestContext, token: string, features: string[]) {
  const res = await request.post(`${API}/platform/tenants/${TENANT}/features`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { enabledFeatures: features },
  });
  expect(res.ok(), `写入能力开关失败: ${features.join(',')}`).toBeTruthy();
}

// Disabling new work must retain authorized historical reading and fulfillment.
test('采购方式能力矩阵:只开商城后保留历史导航且后端拒绝其他方式新增', async ({ page, request }) => {
  const token = await platformToken(request);
  const buyer = (await (await request.post(`${API}/auth/login`, {
    data: { account: 'buyer.owner@example.com', password: 'demo123456', scope: 'BUYER', tenantId: TENANT },
  })).json()).data.accessToken as string;

  try {
    await setFeatures(request, token, ['order', 'finance', 'method:mall']);

    // 能力接口:只剩商城。
    const capability = await (await request.get(`${API}/buyer/capabilities`, {
      headers: { Authorization: `Bearer ${buyer}` },
    })).json();
    expect((capability.data.methods as Array<{ code: string }>).map((m) => m.code)).toEqual(['商城']);
    expect(capability.data.newBusinessModuleIds).not.toContain('rfqs');
    expect(capability.data.historicalModuleIds).toContain('rfqs');
    const history = await request.get(`${API}/buyer/rfqs`, { headers: { Authorization: `Bearer ${buyer}` } });
    expect(history.ok(), '关闭新增后历史询比资料仍可按权限读取').toBeTruthy();

    // 后端门禁:被关的方式直接拒绝立项——不是前端藏起来而已。
    const blocked = await request.post(`${API}/buyer/tenders`, {
      headers: { Authorization: `Bearer ${buyer}` },
      data: { title: 'E2E 应被拒绝的招标', tenderType: '公开招标', budget: 1000 },
    });
    expect(blocked.ok()).toBeFalsy();
    expect(await blocked.text()).toContain('未开通');

    // Authorized history remains reachable; the page clearly distinguishes it from new work.
    await loginViaKeycloak(page);
    await expectLoggedIn(page, /企业商城/);
    const nav = page.getByTestId('app-nav');
    await expect(nav.getByRole('button', { name: /企业商城/ })).toBeVisible();
    await expect(nav.getByRole('button', { name: /询比项目/ })).toBeVisible();
    await expect(nav.getByRole('button', { name: /竞价采购/ })).toBeVisible();
    await expect(nav.getByRole('button', { name: /招标管理/ })).toBeVisible();
    await nav.getByRole('button', { name: /询比项目/ }).click();
    await expect(page.getByText('此采购方式已停止新增业务，仍可按权限查看历史资料并办理既有业务；新增操作须先由平台开通。')).toBeVisible();
  } finally {
    // 还原,避免影响其余用例(本用例改的是共享演示租户)。
    await setFeatures(request, token, FULL_FEATURES);
  }

  // 还原后菜单恢复。
  await page.reload();
  await expect(page.getByTestId('app-nav').getByRole('button', { name: /询比项目/ })).toBeVisible();
});
