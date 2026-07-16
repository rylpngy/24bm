import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectLoggedIn, loginViaKeycloak, openModule } from './helpers';

const API = 'http://localhost:8080/api/v1';

// 前置安排:API 造一单已发布的公开招标(唯一标题)。
async function seedOpenTender(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { account: 'buyer.owner@example.com', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-acme' },
  });
  const token = (await login.json()).data.accessToken as string;
  const title = `E2E领取招标-${Date.now()}`;
  const iso = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
  const created = await request.post(`${API}/buyer/tenders`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title, tenderType: '公开招标', budget: 200000, evaluationMethod: '综合评分法',
      documentHtml: '<p>E2E 公开招标正文:领取后可见。</p>',
      acquisitionDeadline: iso(48), submissionDeadline: iso(96), openingAt: iso(97),
    },
  });
  const id = (await created.json()).data.id as string;
  const pub = await request.post(`${API}/buyer/tenders/${id}/publish`, { headers: { Authorization: `Bearer ${token}` } });
  expect(pub.ok()).toBeTruthy();
  return title;
}

// C-1 行为级:公开招标 → 供应商自助领取 → 领取后正文可读(领取前不下发)。
test('招标项目:公开招标自助领取 → 正文解锁', async ({ page, request }) => {
  const title = await seedOpenTender(request);

  await loginViaKeycloak(page);
  await expectLoggedIn(page, /招标项目/);
  await openModule(page, /招标项目/);
  await expect(page.getByRole('heading', { name: '招标项目', level: 3 })).toBeVisible();

  const row = page.locator('table tr', { hasText: title }).first();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '查看招标' }).click();
  // 领取前:正文不可见,提示领取
  await expect(page.getByText('领取招标文件后方可查阅正文。')).toBeVisible();
  await page.getByRole('button', { name: '领取招标文件' }).click();
  await expect(page.getByText(/招标文件已领取/)).toBeVisible();
  await expect(page.getByText(/E2E 公开招标正文:领取后可见/)).toBeVisible();
});
