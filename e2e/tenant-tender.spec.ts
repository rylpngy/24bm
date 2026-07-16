import { expect, test, type APIRequestContext } from '@playwright/test';
import { expectLoggedIn, loginViaKeycloak, openModule } from './helpers';

// Track C C-1 行为级:招标文件编制(富文本)→ 发布发售 → 台账与详情状态推进。唯一标题可重复执行。
test('招标管理:编制(富文本)→ 发布发售 → 详情要素与领取区', async ({ page }) => {
  const title = `E2E公开招标-${Date.now()}`;
  await loginViaKeycloak(page);
  await expectLoggedIn(page, /招标管理/);
  await openModule(page, /招标管理/);
  await expect(page.getByRole('heading', { name: '招标管理', level: 3 })).toBeVisible();

  await page.getByRole('button', { name: /新建招标项目/ }).click();
  await page.getByPlaceholder(/机房设备公开招标/).fill(title);
  const fmt = (h: number) => {
    const x = new Date(Date.now() + h * 3600_000);
    const p2 = (n: number) => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}T${p2(x.getHours())}:${p2(x.getMinutes())}`;
  };
  const dts = await page.locator('input[type="datetime-local"]').all();
  await dts[0].fill(fmt(48));
  await dts[1].fill(fmt(96));
  await dts[2].fill(fmt(97));
  await page.locator('[contenteditable="true"]').click();
  await page.keyboard.type('项目概况:E2E 行为验证公开招标。投标人资格:平台认证供应商。');
  await page.getByRole('button', { name: /保存并发布发售/ }).click();
  await expect(page.getByText(/已发布,招标文件开始发售/)).toBeVisible();

  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '详情' }).click();
  await expect(page.getByText('招标文件正文')).toBeVisible();
  await expect(page.getByText(/E2E 行为验证公开招标/)).toBeVisible();
  await expect(page.getByText('发售与领取记录')).toBeVisible();
  await expect(page.getByText(/公开招标发售中,供应商在其门户自助领取/)).toBeVisible();
});

const API = 'http://localhost:8080/api/v1';

// 前置安排:API 造一单已投标、已到开标时间的公开招标(唯一标题)。
async function seedOpenedReadyTender(request: APIRequestContext) {
  const buyerLogin = await request.post(`${API}/auth/login`, {
    data: { account: 'buyer.owner@example.com', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-acme' },
  });
  const buyer = (await buyerLogin.json()).data.accessToken as string;
  const supLogin = await request.post(`${API}/auth/login`, {
    data: { account: 'supplier.sales@example.com', password: 'demo123456', scope: 'SUPPLIER', supplierId: 'ent-supplier-sunrise' },
  });
  const sup = (await supLogin.json()).data.accessToken as string;

  const title = `E2E定时解封-${Date.now()}`;
  const iso = (s: number) => new Date(Date.now() + s * 1000).toISOString();
  const created = await request.post(`${API}/buyer/tenders`, {
    headers: { Authorization: `Bearer ${buyer}` },
    data: {
      title, tenderType: '公开招标', budget: 300000, evaluationMethod: '最低评标价法',
      documentHtml: '<p>E2E 开标唱标验证正文。</p>',
      acquisitionDeadline: iso(6), submissionDeadline: iso(8), openingAt: iso(10),
    },
  });
  const id = (await created.json()).data.id as string;
  expect((await request.post(`${API}/buyer/tenders/${id}/publish`, { headers: { Authorization: `Bearer ${buyer}` } })).ok()).toBeTruthy();
  expect((await request.post(`${API}/supplier/tenders/${id}/acquire`, { headers: { Authorization: `Bearer ${sup}` } })).ok()).toBeTruthy();
  expect((await request.post(`${API}/supplier/tenders/${id}/bids`, {
    headers: { Authorization: `Bearer ${sup}` },
    data: { bidAmount: 258000, documentHtml: '<p>E2E 密封投标函。</p>' },
  })).ok()).toBeTruthy();
  // 等到约定开标时间(定时开标:提前开标会被规则拒绝)
  await new Promise((r) => setTimeout(r, 11_000));
  return { title, id, buyer };
}

// C-3 行为级:密封投标 → 到时开标唱标 → 报价解封公示 + 指纹核验通过。
test('开标唱标:定时开标 → 解封报价 → 指纹核验', async ({ page, request }) => {
  const { title } = await seedOpenedReadyTender(request);

  await loginViaKeycloak(page);
  await expectLoggedIn(page, /招标管理/);
  await openModule(page, /招标管理/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '详情' }).click();

  // 开标前:递交登记密封在案,底部出现开标入口
  await expect(page.getByText('投标递交情况')).toBeVisible();
  await expect(page.getByText(/密封在案 1 份/)).toBeVisible();
  await page.getByRole('button', { name: /开标唱标/ }).click();

  // 开标后:金额解封公示 + 指纹核验通过
  await expect(page.getByText(/已开标:密封投标解封唱标/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '开标唱标', exact: true })).toBeVisible();
  await expect(page.getByText('¥258,000.00')).toBeVisible();
  await expect(page.getByText('核验通过', { exact: true })).toBeVisible();
  await expect(page.getByText(/有效投标 1 份/)).toBeVisible();
});

// C-4 行为级:开标 → 组建委员会(3 人)→ 评委交卷(UI 一人 + API 两人)→ 推荐中标标记。
test('评标:组建委员会 → 评分交卷 → 汇总排名与推荐中标', async ({ page, request }) => {
  const { title, id, buyer } = await seedOpenedReadyTender(request);
  expect((await request.post(`${API}/buyer/tenders/${id}/open`, { headers: { Authorization: `Bearer ${buyer}` } })).ok()).toBeTruthy();

  await loginViaKeycloak(page);
  await expectLoggedIn(page, /招标管理/);
  await openModule(page, /招标管理/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '详情' }).click();

  // 组建委员会
  await expect(page.getByText('评标委员会与评分')).toBeVisible();
  await page.getByLabel('评委1姓名').fill('张评委');
  await page.getByLabel('评委2姓名').fill('李评委');
  await page.getByLabel('评委3姓名').fill('王评委');
  await page.getByRole('button', { name: /组建委员会并进入评标/ }).click();
  await expect(page.getByText('评标委员会已组建')).toBeVisible();
  await expect(page.getByText('张评委(组长)')).toBeVisible();

  // 评委1 UI 交卷(显式点选组长,避免默认选中依赖排序)
  await page.getByRole('button', { name: '张评委(组长)' }).click();
  await page.getByLabel(/技术分-/).fill('90');
  await page.getByLabel(/商务分-/).fill('85');
  await page.getByRole('button', { name: /提交「张评委」评分/ }).click();
  await expect(page.getByText(/评委「张评委」评分已提交/)).toBeVisible();

  // 评委2/3 API 交卷
  const listRes = await request.get(`${API}/buyer/tenders`, { headers: { Authorization: `Bearer ${buyer}` } });
  const detail = ((await listRes.json()).data as Array<{ id?: string; evaluators?: Array<{ id?: string }>; bids?: Array<{ id?: string }> }>).find((x) => x.id === id);
  const bidId = detail?.bids?.[0]?.id ?? '';
  for (const ev of (detail?.evaluators ?? []).slice(1)) {
    expect((await request.post(`${API}/buyer/tenders/${id}/scores`, {
      headers: { Authorization: `Bearer ${buyer}` },
      data: { evaluatorId: ev.id, lines: [{ bidId, technicalScore: 88, commercialScore: 80 }] },
    })).ok()).toBeTruthy();
  }

  // 刷新页面(绕过前端查询缓存)再进详情,推荐中标已标记
  await page.reload();
  await openModule(page, /招标管理/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '详情' }).click();
  await expect(page.getByText('评标汇总排名')).toBeVisible();
  await expect(page.getByText('推荐中标', { exact: true })).toBeVisible();
  await expect(page.getByText('已交卷').first()).toBeVisible();
});
