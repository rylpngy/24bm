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
  await expect(page.getByText(/有效投标 1 份/).first()).toBeVisible();
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

  // C-9 评标问询:UI 发出二次报价 → API 以供应商身份答复修订价 → 汇总显示修订价与「二次」标记
  await page.getByLabel('问询内容').fill('报价高于预算,请给出修订报价');
  await page.getByLabel('问询类别').selectOption('二次报价');
  await page.getByRole('button', { name: '发出问询' }).click();
  await expect(page.getByText(/已向投标人发出二次报价/)).toBeVisible();

  const supLogin = await request.post(`${API}/auth/login`, {
    data: { account: 'supplier.sales@example.com', password: 'demo123456', scope: 'SUPPLIER', supplierId: 'ent-supplier-sunrise' },
  });
  const sup = (await supLogin.json()).data.accessToken as string;
  const svList = await request.get(`${API}/supplier/tenders`, { headers: { Authorization: `Bearer ${sup}` } });
  const sv = ((await svList.json()).data as Array<{ id?: string; inquiries?: Array<{ id?: string; kind?: string }> }>).find((x) => x.id === id);
  const inq = sv?.inquiries?.find((i) => i.kind === '二次报价');
  expect((await request.post(`${API}/supplier/tenders/${id}/inquiries/${inq?.id}/answer`, {
    headers: { Authorization: `Bearer ${sup}` },
    data: { answer: 'E2E 同意下调', revisedAmount: 168000 },
  })).ok()).toBeTruthy();

  await page.reload();
  await openModule(page, /招标管理/);
  await page.getByPlaceholder(/按项目名称/).fill(title);
  await page.getByRole('button', { name: '搜索' }).click();
  await page.locator('table tr', { hasText: title }).first().getByRole('button', { name: '详情' }).click();
  await expect(page.getByText('E2E 同意下调')).toBeVisible();
  await expect(page.getByText('¥168,000.00').first()).toBeVisible();
  await expect(page.getByText('二次', { exact: true }).first()).toBeVisible();
});

// C-5 行为级:评标完成 → 定标(默认推荐)+ 手写签章通知书 → 结果卡与签章留痕。
test('定标:签章中标通知书 → 结果公示与留痕', async ({ page, request }) => {
  const { title, id, buyer } = await seedOpenedReadyTender(request);
  expect((await request.post(`${API}/buyer/tenders/${id}/open`, { headers: { Authorization: `Bearer ${buyer}` } })).ok()).toBeTruthy();
  const committee = await request.post(`${API}/buyer/tenders/${id}/committee`, {
    headers: { Authorization: `Bearer ${buyer}` },
    data: { members: [{ name: '张评委', role: '组长' }, { name: '李评委', role: '成员' }, { name: '王评委', role: '成员' }] },
  });
  const detail = (await committee.json()).data as { evaluators?: Array<{ id?: string }>; bids?: Array<{ id?: string }> };
  const bidId = detail.bids?.[0]?.id ?? '';
  for (const ev of detail.evaluators ?? []) {
    await request.post(`${API}/buyer/tenders/${id}/scores`, {
      headers: { Authorization: `Bearer ${buyer}` },
      data: { evaluatorId: ev.id, lines: [{ bidId, technicalScore: 90, commercialScore: 85 }] },
    });
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
  await submit.click();
  await expect(page.getByText(/已定标并签章中标通知书/)).toBeVisible();
  await expect(page.getByText('定标结果与中标通知书')).toBeVisible();
  await expect(page.getByText('中标人', { exact: true })).toBeVisible();
  await expect(page.getByText('招标人签章留痕')).toBeVisible();

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
