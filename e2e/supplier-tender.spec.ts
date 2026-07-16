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
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();

  const row = page.locator('table tr', { hasText: title }).first();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '查看招标' }).click();
  // 领取前:正文不可见,提示领取
  await expect(page.getByText('领取招标文件后方可查阅正文。')).toBeVisible();
  await page.getByRole('button', { name: '领取招标文件' }).click();
  await expect(page.getByText(/招标文件已领取/)).toBeVisible();
  await expect(page.getByText(/E2E 公开招标正文:领取后可见/)).toBeVisible();
});

// C-2 行为级:领取 → 密封递交(签名必签)→ 密封凭证 → 撤回 → 重投覆盖为新密封。
test('投标加密递交:签署密封 → 凭证 → 撤回重投', async ({ page, request }) => {
  const title = await seedOpenTender(request);

  await loginViaKeycloak(page);
  await expectLoggedIn(page, /招标项目/);
  await openModule(page, /招标项目/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  const row = page.locator('table tr', { hasText: title }).first();
  await row.getByRole('button', { name: '领取文件' }).click();
  await expect(page.getByText(/招标文件已领取/)).toBeVisible();
  await row.getByRole('button', { name: '查看招标' }).click();
  await expect(page.getByText('投标递交(加密密封)')).toBeVisible();

  const submit = page.getByRole('button', { name: /签署并密封递交/ });
  await expect(submit).toBeDisabled();
  await page.locator('input[aria-label="投标报价"]').fill('188000');
  await page.locator('[contenteditable="true"]').last().click();
  await page.keyboard.type('E2E 投标函:全面响应招标文件条款。');
  await expect(submit).toBeDisabled(); // 未签名仍禁用
  const canvas = page.getByTestId('signature-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas missing');
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + box.height / 2 - 12, { steps: 8 });
  await page.mouse.up();
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText('本方投标已密封在案')).toBeVisible();
  await expect(page.getByText('密封指纹', { exact: true })).toBeVisible();
  // 撤回 → 重投窗口开放
  await page.getByRole('button', { name: /撤回投标/ }).click();
  await expect(page.getByText(/此前投标已于/)).toBeVisible();
  await expect(page.getByRole('button', { name: /签署并密封递交/ })).toBeVisible();
});

// C-3 行为级(供应商侧):开标后唱标公示可见——本方高亮、报价公示、核验通过。
test('唱标公示:开标后供应商可见公示与核验', async ({ page, request }) => {
  const login = await request.post(`${API}/auth/login`, {
    data: { account: 'buyer.owner@example.com', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-acme' },
  });
  const buyer = (await login.json()).data.accessToken as string;
  const supLogin = await request.post(`${API}/auth/login`, {
    data: { account: 'supplier.sales@example.com', password: 'demo123456', scope: 'SUPPLIER', supplierId: 'ent-supplier-sunrise' },
  });
  const sup = (await supLogin.json()).data.accessToken as string;
  const title = `E2E供方唱标-${Date.now()}`;
  const iso = (s: number) => new Date(Date.now() + s * 1000).toISOString();
  const created = await request.post(`${API}/buyer/tenders`, {
    headers: { Authorization: `Bearer ${buyer}` },
    data: {
      title, tenderType: '公开招标', budget: 300000, evaluationMethod: '最低评标价法',
      documentHtml: '<p>E2E 供方唱标正文。</p>',
      acquisitionDeadline: iso(6), submissionDeadline: iso(8), openingAt: iso(10),
    },
  });
  const id = (await created.json()).data.id as string;
  await request.post(`${API}/buyer/tenders/${id}/publish`, { headers: { Authorization: `Bearer ${buyer}` } });
  await request.post(`${API}/supplier/tenders/${id}/acquire`, { headers: { Authorization: `Bearer ${sup}` } });
  await request.post(`${API}/supplier/tenders/${id}/bids`, {
    headers: { Authorization: `Bearer ${sup}` },
    data: { bidAmount: 199000, documentHtml: '<p>E2E 供方投标函。</p>' },
  });
  await new Promise((r) => setTimeout(r, 11_000));
  expect((await request.post(`${API}/buyer/tenders/${id}/open`, { headers: { Authorization: `Bearer ${buyer}` } })).ok()).toBeTruthy();

  await loginViaKeycloak(page);
  await expectLoggedIn(page, /招标项目/);
  await openModule(page, /招标项目/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '查看招标' }).click();
  await expect(page.getByText('开标唱标公示')).toBeVisible();
  await expect(page.getByText('¥199,000.00')).toBeVisible();
  await expect(page.getByText('核验通过', { exact: true })).toBeVisible();
  await expect(page.getByText('本方', { exact: true })).toBeVisible();
});
