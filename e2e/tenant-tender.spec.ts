import { expect, test, type APIRequestContext } from '@playwright/test';
import { createHash } from 'node:crypto';
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

  // 台账按标题检索后进详情(存量数据下本单未必落在首页);无需 reload——
  // 发布后列表由失效驱动刷新,「首次加载在途导致失效被去重」已在 QueryClient 层修掉。
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
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
      acquisitionDeadline: iso(12), submissionDeadline: iso(14), openingAt: iso(16),
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const createdTender = (await created.json()).data;
  const id = createdTender.id as string;
  expect((await request.post(`${API}/buyer/tenders/${id}/publish`, { headers: { Authorization: `Bearer ${buyer}` } })).ok()).toBeTruthy();
  expect((await request.post(`${API}/supplier/tenders/${id}/acquire`, { headers: { Authorization: `Bearer ${sup}` } })).ok()).toBeTruthy();
  expect((await request.post(`${API}/supplier/tenders/${id}/bids`, {
    headers: { Authorization: `Bearer ${sup}` },
    data: { bidAmount: 258000, documentHtml: '<p>E2E 密封投标函。</p>' },
  })).ok()).toBeTruthy();
  // 等到约定开标时间(定时开标:提前开标会被规则拒绝)
  await expect.poll(() => Date.now(), { timeout: 20_000 }).toBeGreaterThanOrEqual(Date.parse(createdTender.openingAt));
  return { title, id, buyer, sup };
}

async function tenderDetail(request: APIRequestContext, buyer: string, id: string) {
  const response = await request.get(`${API}/buyer/tenders`, { headers: { Authorization: `Bearer ${buyer}` } });
  expect(response.ok(), await response.text()).toBeTruthy();
  const detail = (await response.json()).data.find((t: { id: string }) => t.id === id);
  expect(detail).toBeTruthy();
  return detail;
}

// C-3 行为级:密封投标 → 到时开标唱标 → 报价解封公示 + 指纹核验通过。
test('开标唱标:定时开标 → 解封报价 → 指纹核验', async ({ page, request }) => {
  const { title, id, buyer } = await seedOpenedReadyTender(request);

  await loginViaKeycloak(page);
  await expectLoggedIn(page, /招标管理/);
  await openModule(page, /招标管理/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '详情' }).click();

  // 开标前:递交登记密封在案,底部出现开标入口
  await expect(page.getByText('投标递交情况')).toBeVisible();
  await expect(page.getByText(/密封在案 1 份/)).toBeVisible();
  const sealed = (await tenderDetail(request, buyer, id)).bids;
  expect(sealed).toHaveLength(1);
  expect(sealed[0].bidAmount).toBeNull();
  expect(sealed[0].documentHtml).toBeNull();
  const openedResponse = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/buyer/tenders/${id}/open`));
  await page.getByRole('button', { name: /开标唱标/ }).click();
  expect((await openedResponse).ok()).toBeTruthy();

  // 开标后:金额解封公示 + 指纹核验通过
  await expect(page.getByText('已开标:投标报价及指纹核验结果可在项目详情查看。', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '开标唱标', exact: true })).toBeVisible();
  await expect(page.getByText('¥258,000.00')).toBeVisible();
  await expect(page.getByText('核验通过', { exact: true })).toBeVisible();
  await expect(page.getByText(/已开启投标 1 份/).first()).toBeVisible();
  const opened = (await tenderDetail(request, buyer, id)).bids[0];
  expect(opened.digestVerified).toBe(true);
  expect(opened.evaluationEligible).toBe(true);
  expect(opened.bidAmount).toBe(258000);
});

// C-4 行为级:开标 → 组建委员会(3 人)→ 评委交卷(UI 一人 + API 两人)→ 推荐中标标记。
test('评标:组建委员会 → 评分交卷 → 汇总排名与推荐中标', async ({ page, request }) => {
  const { title, id, buyer, sup } = await seedOpenedReadyTender(request);
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

  const detail = await tenderDetail(request, buyer, id);
  const eligible = detail.bids.filter((b: { evaluationEligible?: boolean }) => b.evaluationEligible === true);
  expect(eligible).toHaveLength(1);
  const bidId = eligible[0].id;

  // 问询和二次报价须在评分前完成,不能在全员交卷后改变评审依据。
  await page.getByLabel('问询内容').fill('报价高于预算,请给出修订报价');
  await page.getByLabel('问询类别').selectOption('二次报价');
  const inquiryResponse = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/buyer/tenders/${id}/inquiries`));
  await page.getByRole('button', { name: '发出问询' }).click();
  expect((await inquiryResponse).ok()).toBeTruthy();
  await expect(page.getByText(/已向投标人发出二次报价/)).toBeVisible();
  const supplierList = await request.get(`${API}/supplier/tenders`, { headers: { Authorization: `Bearer ${sup}` } });
  expect(supplierList.ok()).toBeTruthy();
  const supplierTender = (await supplierList.json()).data.find((t: { id: string }) => t.id === id);
  const inquiry = supplierTender.inquiries.find((i: { kind: string }) => i.kind === '二次报价');
  expect(inquiry?.id).toBeTruthy();
  const pendingScore = await request.post(`${API}/buyer/tenders/${id}/scores`, {
    headers: { Authorization: `Bearer ${buyer}` },
    data: { evaluatorId: detail.evaluators[0].id, lines: [{ bidId, technicalScore: 90, commercialScore: 85 }] },
  });
  expect(pendingScore.status()).toBe(400);
  expect((await pendingScore.json()).message).toContain('问询答复');
  expect((await tenderDetail(request, buyer, id)).scores).toHaveLength(0);
  const answered = await request.post(`${API}/supplier/tenders/${id}/inquiries/${inquiry.id}/answer`, {
    headers: { Authorization: `Bearer ${sup}` }, data: { answer: 'E2E 同意下调', revisedAmount: 168000 },
  });
  expect(answered.ok(), await answered.text()).toBeTruthy();
  await page.reload();
  await openModule(page, /招标管理/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '详情' }).click();

  // 评委1 UI 交卷(显式点选组长,避免默认选中依赖排序)
  await page.getByRole('button', { name: '张评委(组长)' }).click();
  await page.getByLabel(/技术分-/).fill('90');
  await page.getByLabel(/商务分-/).fill('85');
  await page.getByRole('button', { name: /提交「张评委」评分/ }).click();
  await expect(page.getByText(/评委「张评委」评分已提交/)).toBeVisible();

  // 评委2/3 API 交卷
  expect((await tenderDetail(request, buyer, id)).evaluationSummary.some((r: { recommended: boolean }) => r.recommended)).toBe(false);
  for (const ev of detail.evaluators.filter((e: { evaluatorName: string }) => e.evaluatorName !== '张评委')) {
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
  await expect(page.getByText('评委交卷 3/3', { exact: true })).toBeVisible();
  await expect(page.getByText('E2E 同意下调')).toBeVisible();
  await expect(page.getByText('¥168,000.00').first()).toBeVisible();
  await expect(page.getByText('二次', { exact: true }).first()).toBeVisible();
  const completed = await tenderDetail(request, buyer, id);
  expect(completed.evaluators.every((e: { scoredCount: number }) => e.scoredCount === eligible.length)).toBe(true);
  expect(completed.evaluationSummary.find((r: { bidId: string }) => r.bidId === bidId).effectiveAmount).toBe(168000);
  const lateInquiry = await request.post(`${API}/buyer/tenders/${id}/inquiries`, {
    headers: { Authorization: `Bearer ${buyer}` }, data: { bidId, kind: '二次报价', question: '评分后不得变更报价' },
  });
  expect(lateInquiry.status()).toBe(400);
  expect((await lateInquiry.json()).message).toContain('已有评分留痕');
  const unchanged = await tenderDetail(request, buyer, id);
  expect(unchanged.inquiries).toEqual(completed.inquiries);
  expect(unchanged.scores).toEqual(completed.scores);
  expect(unchanged.evaluationSummary).toEqual(completed.evaluationSummary);
});

// C-5:定标后另行保存站内手写签署记录,不将定标成功等同于签署成功或外部 CA 认证。
test('定标:手写签署中标通知书 → 结果与真实签署留痕', async ({ page, request }) => {
  const { title, id, buyer } = await seedOpenedReadyTender(request);
  expect((await request.post(`${API}/buyer/tenders/${id}/open`, { headers: { Authorization: `Bearer ${buyer}` } })).ok()).toBeTruthy();
  const committee = await request.post(`${API}/buyer/tenders/${id}/committee`, {
    headers: { Authorization: `Bearer ${buyer}` },
    data: { members: [{ name: '张评委', role: '组长' }, { name: '李评委', role: '成员' }, { name: '王评委', role: '成员' }] },
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
      data: { evaluatorId: ev.id, lines: [{ bidId, technicalScore: 90, commercialScore: 85 }] },
    });
    expect(scored.ok(), await scored.text()).toBeTruthy();
  }

  await loginViaKeycloak(page);
  await expectLoggedIn(page, /招标管理/);
  await openModule(page, /招标管理/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '详情' }).click();

  await expect(page.getByText('定标与中标通知书')).toBeVisible();
  await expect(page.getByRole('button', { name: /(推荐)/ })).toBeVisible();
  const submit = page.getByRole('button', { name: /定标并签章中标通知书/ });
  await expect(submit).toBeDisabled(); // 未签章禁用
  const canvas = page.getByTestId('signature-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas missing');
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + box.height / 2 - 10, { steps: 8 });
  await page.mouse.up();
  await expect(submit).toBeEnabled();
  const awardResponse = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith(`/buyer/tenders/${id}/award`));
  const signatureResponse = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/buyer/esign-records'));
  await submit.click();
  expect((await awardResponse).ok()).toBeTruthy();
  const signature = await signatureResponse;
  expect(signature.ok(), await signature.text()).toBeTruthy();
  await expect(page.getByText('已定标,中标通知书站内签署记录已保存。', { exact: true })).toBeVisible();
  await expect(page.getByText('定标结果与中标通知书')).toBeVisible();
  await expect(page.getByText('中标人', { exact: true })).toBeVisible();
  await expect(page.getByText('招标人签章留痕')).toBeVisible();
  const awarded = await tenderDetail(request, buyer, id);
  expect(awarded.status).toBe('已定标');
  expect(awarded.awardedBidId).toBe(bidId);
  const recordsResponse = await request.get(`${API}/buyer/esign-records?targetType=tender-award&targetId=${id}`, {
    headers: { Authorization: `Bearer ${buyer}` },
  });
  expect(recordsResponse.ok()).toBeTruthy();
  const records = (await recordsResponse.json()).data;
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ targetType: 'tender-award', targetId: id, signerScope: 'BUYER' });
  expect(records[0].signedAt).toBeTruthy();
  expect(records[0].signatureImage).toMatch(/^data:image\/png;base64,/);
  const winner = awarded.bids.find((b: { id: string }) => b.id === bidId);
  const sha = (value: string) => createHash('sha256').update(value).digest('hex');
  expect(records[0].contentDigest).toBe(sha(`tender-award:${id}|bid:${bidId}|supplier:${winner.supplierId}|sealedDigest:${winner.contentDigest}|notice:${sha(awarded.awardNoticeHtml)}`));

  // C-7 中标转执行:填预计到货日期 → 生成执行采购订单 → 订单号回显
  const dateStr = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  await page.getByLabel('预计到货日期').fill(dateStr);
  await page.getByRole('button', { name: '生成执行采购订单' }).click();
  await expect(page.getByText(/中标转执行:采购订单 po-/)).toBeVisible();
  await expect(page.getByText('执行订单已生成:')).toBeVisible();

  // C-8 公告记录:发布与定标节点自动生成并同步门户
  await expect(page.getByText('公告记录')).toBeVisible();
  await expect(page.getByText(/中标公示/).first()).toBeVisible();
});

// C-6 行为级:开标(无投标)→ 宣布流标(原因必填)→ 留痕卡 → 一键重新招标进入编制页。
test('流标:留痕 → 重新招标复制要素', async ({ page, request }) => {
  const { title, id, buyer } = await seedOpenedReadyTender(request);
  expect((await request.post(`${API}/buyer/tenders/${id}/open`, { headers: { Authorization: `Bearer ${buyer}` } })).ok()).toBeTruthy();

  await loginViaKeycloak(page);
  await expectLoggedIn(page, /招标管理/);
  await openModule(page, /招标管理/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '详情' }).click();

  await page.getByRole('button', { name: '宣布流标' }).click();
  const confirm = page.getByRole('button', { name: '确认流标' });
  await expect(confirm).toBeDisabled(); // 原因未填禁用
  await page.getByLabel('流标原因').fill('E2E:评审全部不合格');
  await confirm.click();
  await expect(page.getByText(/已宣布流标/)).toBeVisible();
  await expect(page.getByText('流标留痕')).toBeVisible();
  await expect(page.getByText(/流标公告/).first()).toBeVisible();
  await expect(page.getByText('E2E:评审全部不合格', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '重新招标', exact: true }).click();
  // 直接跳入新草稿编制页,标题带(重招)、正文继承
  await expect(page.getByRole('heading', { name: '编辑招标项目' })).toBeVisible();
  await expect(page.locator('input').first()).toHaveValue(new RegExp('重招'));
});

// C-6 行为级:开标(无投标)→ 宣布流标(原因必填)→ 留痕卡 → 一键重新招标进入编制页。
// F-1 行为级:编制期开启资格预审 → 供应商申请(API)→ 采购端审查通过/不通过 → 领取门槛生效。
test('资格预审:开启 → 审查不通过拦截领取 → 复审通过后放行', async ({ page, request }) => {
  const buyerLogin = await request.post(`${API}/auth/login`, {
    data: { account: 'buyer.owner@example.com', password: 'demo123456', scope: 'BUYER', tenantId: 'tenant-acme' },
  });
  const buyer = (await buyerLogin.json()).data.accessToken as string;
  const supLogin = await request.post(`${API}/auth/login`, {
    data: { account: 'supplier.sales@example.com', password: 'demo123456', scope: 'SUPPLIER', supplierId: 'ent-supplier-sunrise' },
  });
  const sup = (await supLogin.json()).data.accessToken as string;

  const title = `E2E资格预审-${Date.now()}`;
  const iso = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
  const created = await request.post(`${API}/buyer/tenders`, {
    headers: { Authorization: `Bearer ${buyer}` },
    data: {
      title, tenderType: '公开招标', budget: 400000, evaluationMethod: '综合评分法',
      documentHtml: '<p>E2E 资格预审验证正文。</p>',
      acquisitionDeadline: iso(48), submissionDeadline: iso(96), openingAt: iso(97),
    },
  });
  const id = (await created.json()).data.id as string;

  await loginViaKeycloak(page);
  await expectLoggedIn(page, /招标管理/);
  await openModule(page, /招标管理/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '详情' }).click();

  // 编制期开启预审开关
  await expect(page.getByRole('heading', { name: '资格预审', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '开启资格预审' }).click();
  await expect(page.getByText('已开启资格预审要求。')).toBeVisible();
  await expect(page.getByText('实行资格预审', { exact: true })).toBeVisible();

  // 发布发售后:未申请不得领取;供应商提交申请
  expect((await request.post(`${API}/buyer/tenders/${id}/publish`, { headers: { Authorization: `Bearer ${buyer}` } })).ok()).toBeTruthy();
  const blocked = await request.post(`${API}/supplier/tenders/${id}/acquire`, { headers: { Authorization: `Bearer ${sup}` } });
  expect(blocked.ok()).toBeFalsy();
  expect((await request.post(`${API}/supplier/tenders/${id}/prequalification`, {
    headers: { Authorization: `Bearer ${sup}` },
    data: { application: 'E2E:具备二级资质与同类业绩。' },
  })).ok()).toBeTruthy();

  // 采购端审查:先不通过,领取仍被拦截
  await page.reload();
  await openModule(page, /招标管理/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '详情' }).click();
  await expect(page.getByText('E2E:具备二级资质与同类业绩。')).toBeVisible();
  const commentBox = page.getByLabel(/^审查意见 /);
  await commentBox.fill('E2E:业绩证明缺件');
  await page.getByRole('button', { name: '不通过' }).click();
  await expect(page.getByText(/已完成资格预审/)).toBeVisible();
  await expect(page.getByText('E2E:业绩证明缺件')).toBeVisible();
  const stillBlocked = await request.post(`${API}/supplier/tenders/${id}/acquire`, { headers: { Authorization: `Bearer ${sup}` } });
  expect(stillBlocked.ok()).toBeFalsy();

  // 供应商补正重提 → 采购端通过 → 领取放行
  expect((await request.post(`${API}/supplier/tenders/${id}/prequalification`, {
    headers: { Authorization: `Bearer ${sup}` },
    data: { application: 'E2E:已补充合同扫描件。' },
  })).ok()).toBeTruthy();
  await page.reload();
  await openModule(page, /招标管理/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '详情' }).click();
  await page.getByLabel(/^审查意见 /).fill('E2E:资质业绩满足要求');
  await page.getByRole('button', { name: '通过', exact: true }).click();
  await expect(page.getByText(/已完成资格预审/)).toBeVisible();
  const allowed = await request.post(`${API}/supplier/tenders/${id}/acquire`, { headers: { Authorization: `Bearer ${sup}` } });
  expect(allowed.ok()).toBeTruthy();
});
