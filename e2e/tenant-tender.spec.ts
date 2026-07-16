import { expect, test } from '@playwright/test';
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
