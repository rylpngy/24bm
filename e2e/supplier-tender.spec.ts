import { expect, test, type APIRequestContext } from '@playwright/test';
import { createHash } from 'node:crypto';
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
  expect(created.ok(), await created.text()).toBeTruthy();
  const id = (await created.json()).data.id as string;
  const pub = await request.post(`${API}/buyer/tenders/${id}/publish`, { headers: { Authorization: `Bearer ${token}` } });
  expect(pub.ok()).toBeTruthy();
  return { title, id, buyer: token };
}

// C-1 行为级:公开招标 → 供应商自助领取 → 领取后正文可读(领取前不下发)。
test('招标项目:公开招标自助领取 → 正文解锁', async ({ page, request }) => {
  const { title } = await seedOpenTender(request);

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
  await expect(page.getByText(/招标文件已领取/).first()).toBeVisible();
  await expect(page.getByText(/E2E 公开招标正文:领取后可见/)).toBeVisible();
});

// 站内密封与手写签署留痕,不宣称加密托管或外部 CA 认证。
test('投标站内密封:手写签署 → 密封凭证 → 撤回重投', async ({ page, request }) => {
  const { title, id, buyer } = await seedOpenTender(request);

  await loginViaKeycloak(page);
  await expectLoggedIn(page, /招标项目/);
  await openModule(page, /招标项目/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  const row = page.locator('table tr', { hasText: title }).first();
  await row.getByRole('button', { name: '领取文件' }).click();
  await expect(page.getByText(/招标文件已领取/).first()).toBeVisible();
  await row.getByRole('button', { name: '查看招标' }).click();
  await expect(page.getByText('投标递交(站内密封)', { exact: true })).toBeVisible();

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
  const bidResponse = page.waitForResponse(r => r.request().method() === 'POST' && /\/supplier\/tenders\/[^/]+\/bids$/.test(r.url()));
  const signatureResponse = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/supplier/esign-records'));
  await submit.click();
  const submitted = await bidResponse;
  expect(submitted.ok(), await submitted.text()).toBeTruthy();
  const bid = (await submitted.json()).data;
  expect(bid).toMatchObject({ sealedStatus: '已密封', bidAmount: 188000, supplierId: 'ent-supplier-sunrise' });
  expect(bid.contentDigest).toMatch(/^[a-f0-9]{64}$/);
  const signature = await signatureResponse;
  expect(signature.ok(), await signature.text()).toBeTruthy();
  const record = (await signature.json()).data;
  expect(record).toMatchObject({ targetType: 'tender-bid', targetId: bid.id, signerScope: 'SUPPLIER' });
  const sha = (value: string) => createHash('sha256').update(value).digest('hex');
  expect(record.contentDigest).toBe(sha(`tender-bid:${bid.id}|tender:${bid.tenderId}|supplier:${bid.supplierId}|sealedDigest:${bid.contentDigest}`));
  expect(record.signatureImage).toMatch(/^data:image\/png;base64,/);
  await expect(page.getByText('投标已密封递交,站内电子签署记录已保存。', { exact: true })).toBeVisible();

  await expect(page.getByText('本方投标已密封在案')).toBeVisible();
  await expect(page.getByText('密封指纹', { exact: true })).toBeVisible();
  const buyerList = await request.get(`${API}/buyer/tenders`, { headers: { Authorization: `Bearer ${buyer}` } });
  expect(buyerList.ok()).toBeTruthy();
  const sealed = (await buyerList.json()).data.find((t: { id: string }) => t.id === id).bids[0];
  expect(sealed).toMatchObject({ id: bid.id, sealedStatus: '已密封', bidAmount: null, documentHtml: null });
  // 撤回 → 重投窗口开放
  const withdrawal = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/supplier/tenders/${id}/bids/withdraw`));
  await page.getByRole('button', { name: /撤回投标/ }).click();
  const withdrawn = await withdrawal;
  expect(withdrawn.ok()).toBeTruthy();
  expect((await withdrawn.json()).data.sealedStatus).toBe('已撤回');
  await expect(page.getByText(/此前投标已于/)).toBeVisible();
  await expect(page.getByRole('button', { name: /签署并密封递交/ })).toBeVisible();
  // 实际重投,并核对同一份在案记录的密封摘要随新内容变化。
  await page.getByLabel('投标报价', { exact: true }).fill('177000');
  await page.locator('[contenteditable="true"]').last().fill('E2E 修订投标函:重新响应招标文件。');
  const nextCanvas = page.getByTestId('signature-canvas');
  await nextCanvas.scrollIntoViewIfNeeded();
  const nextBox = await nextCanvas.boundingBox();
  if (!nextBox) throw new Error('signature canvas missing after withdrawal');
  await page.mouse.move(nextBox.x + 40, nextBox.y + nextBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(nextBox.x + 150, nextBox.y + nextBox.height / 2 - 10, { steps: 8 });
  await page.mouse.up();
  const resubmission = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/supplier/tenders/${bid.tenderId}/bids`));
  const resigning = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/supplier/esign-records'));
  await page.getByRole('button', { name: /签署并密封递交/ }).click();
  const resubmitted = await resubmission;
  expect(resubmitted.ok(), await resubmitted.text()).toBeTruthy();
  const updated = (await resubmitted.json()).data;
  expect(updated).toMatchObject({ id: bid.id, bidAmount: 177000, sealedStatus: '已密封', withdrawnAt: null });
  expect(updated.contentDigest).not.toBe(bid.contentDigest);
  expect((await resigning).ok()).toBeTruthy();
  await expect(page.getByText('本方投标已密封在案')).toBeVisible();
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
      acquisitionDeadline: iso(12), submissionDeadline: iso(14), openingAt: iso(16),
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const fixture = (await created.json()).data;
  const id = fixture.id as string;
  expect((await request.post(`${API}/buyer/tenders/${id}/publish`, { headers: { Authorization: `Bearer ${buyer}` } })).ok()).toBeTruthy();
  expect((await request.post(`${API}/supplier/tenders/${id}/acquire`, { headers: { Authorization: `Bearer ${sup}` } })).ok()).toBeTruthy();
  expect((await request.post(`${API}/supplier/tenders/${id}/bids`, {
    headers: { Authorization: `Bearer ${sup}` },
    data: { bidAmount: 199000, documentHtml: '<p>E2E 供方投标函。</p>' },
  })).ok()).toBeTruthy();
  await expect.poll(() => Date.now(), { timeout: 20_000 }).toBeGreaterThanOrEqual(Date.parse(fixture.openingAt));
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

// 仅定标未签署的通知书可读,不得凭定标状态声称招标人已签署。
test('中标公示:中标人可读通知书且未签署不冒充已签署', async ({ page, request }) => {
  const login = await request.post(`${API}/auth/login`, {
    data: { account: 'buyer.owner@example.com', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-acme' },
  });
  const buyer = (await login.json()).data.accessToken as string;
  const supLogin = await request.post(`${API}/auth/login`, {
    data: { account: 'supplier.sales@example.com', password: 'demo123456', scope: 'SUPPLIER', supplierId: 'ent-supplier-sunrise' },
  });
  const sup = (await supLogin.json()).data.accessToken as string;
  const title = `E2E中标公示-${Date.now()}`;
  const iso = (s: number) => new Date(Date.now() + s * 1000).toISOString();
  const created = await request.post(`${API}/buyer/tenders`, {
    headers: { Authorization: `Bearer ${buyer}` },
    data: {
      title, tenderType: '公开招标', budget: 300000, evaluationMethod: '综合评分法',
      documentHtml: '<p>E2E 中标公示正文。</p>',
      acquisitionDeadline: iso(12), submissionDeadline: iso(14), openingAt: iso(16),
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const fixture = (await created.json()).data;
  const id = fixture.id as string;
  expect((await request.post(`${API}/buyer/tenders/${id}/publish`, { headers: { Authorization: `Bearer ${buyer}` } })).ok()).toBeTruthy();
  expect((await request.post(`${API}/supplier/tenders/${id}/acquire`, { headers: { Authorization: `Bearer ${sup}` } })).ok()).toBeTruthy();
  expect((await request.post(`${API}/supplier/tenders/${id}/bids`, {
    headers: { Authorization: `Bearer ${sup}` },
    data: { bidAmount: 268000, documentHtml: '<p>E2E 投标函。</p>' },
  })).ok()).toBeTruthy();
  await expect.poll(() => Date.now(), { timeout: 20_000 }).toBeGreaterThanOrEqual(Date.parse(fixture.openingAt));
  expect((await request.post(`${API}/buyer/tenders/${id}/open`, { headers: { Authorization: `Bearer ${buyer}` } })).ok()).toBeTruthy();
  const committee = await request.post(`${API}/buyer/tenders/${id}/committee`, {
    headers: { Authorization: `Bearer ${buyer}` },
    data: { members: [{ name: '甲', role: '组长' }, { name: '乙', role: '成员' }, { name: '丙', role: '成员' }] },
  });
  expect(committee.ok(), await committee.text()).toBeTruthy();
  const detail = (await committee.json()).data;
  const eligible = detail.bids.filter((b: { evaluationEligible?: boolean }) => b.evaluationEligible === true);
  expect(eligible).toHaveLength(1);
  expect(detail.evaluators).toHaveLength(3);
  const bidId = eligible[0].id;
  for (const ev of detail.evaluators) {
    const scored = await request.post(`${API}/buyer/tenders/${id}/scores`, {
      headers: { Authorization: `Bearer ${buyer}` },
      data: { evaluatorId: ev.id, lines: [{ bidId, technicalScore: 88, commercialScore: 82 }] },
    });
    expect(scored.ok(), await scored.text()).toBeTruthy();
  }
  expect((await request.post(`${API}/buyer/tenders/${id}/award`, {
    headers: { Authorization: `Bearer ${buyer}` },
    data: { bidId, awardNoticeHtml: '<p>E2E 中标通知:恭喜贵方中标。</p>' },
  })).ok()).toBeTruthy();

  await loginViaKeycloak(page);
  await expectLoggedIn(page, /招标项目/);
  await openModule(page, /招标项目/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '查看招标' }).click();
  await expect(page.getByRole('heading', { name: '中标结果公示' })).toBeVisible();
  await expect(page.getByText(/贵方为本项目中标人/)).toBeVisible();
  await expect(page.getByText(/E2E 中标通知:恭喜贵方中标/)).toBeVisible();
  await expect(page.getByText(/招标人已电子签章|招标人已签章/)).toHaveCount(0);
});
