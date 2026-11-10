import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "/Users/note/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { fixture } from "./agency-technical-fixture.mjs";
const f = await fixture(".p0/p3-method-invitation-session.json"),
  { s, token } = f,
  browser = await chromium.launch({
    headless: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  }),
  checks = [],
  errors = [],
  pass = (x) => {
    checks.push(x);
    console.log("PASS", x);
  };
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (s) => {if(location.protocol==="http:" && location.host==="127.0.0.1:15173")localStorage.setItem("24bid.tenant-portal.session", JSON.stringify(s));},
    {
      token,
      userId: s.userId,
      tenantId: s.tenantId,
      displayName: "合成非AI技术验证",
    },
  );
  await page.goto(
    `http://127.0.0.1:15173/?module=agency&recordId=${s.packageId}`,
  );
  const workspace = page.getByRole("region", { name: "采购执行工作台" });
  await workspace.waitFor();
  await workspace
    .getByRole("tab", { name: "文件编制与审批", exact: true })
    .click();
  const purchase = workspace
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /完整采购文件 ·/ }) })
    .first();
  await purchase.waitFor();
  await purchase
    .locator("summary")
    .filter({ hasText: "Office 在线整稿编辑" })
    .click();
  await purchase
    .getByText(
      "在线文档服务尚未配置。可以继续下载当前稿、本地Word编辑并上传整份候选稿。",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await purchase
      .getByRole("button", { name: "打开当前整稿在线编辑" })
      .count(),
    0,
  );
  pass(
    "Actual browser shows honest whole-DOCX fallback while Office runtime is disabled",
  );
  const summary = purchase
    .locator("summary")
    .filter({ hasText: "此版本PDF预览" })
    .first();
  await summary.click();
  const preview = summary.locator("..");
  await preview
    .getByRole("button", { name: "打开PDF预览", exact: true })
    .waitFor();
  await preview
    .getByRole("button", { name: "打开PDF预览", exact: true })
    .click();
  await preview.locator('iframe[title="采购文书PDF预览"]').waitFor();
  assert.ok(
    (await preview.locator("iframe").getAttribute("src")).startsWith("blob:"),
  );
  const downloading = page.waitForEvent("download");
  await preview
    .getByRole("button", { name: "下载PDF预览", exact: true })
    .click();
  const download = await downloading;
  await download.saveAs(".p0/p6-browser-preview.pdf");
  assert.equal(
    (await fs.readFile(".p0/p6-browser-preview.pdf")).subarray(0, 5).toString(),
    "%PDF-",
  );
  pass(
    "Actual browser opens sealed PDF blob and downloads real PDF bytes for the exact revision",
  );
  await preview.getByRole("button",{name:"关闭预览",exact:true}).click();
  await workspace.getByRole("tab", { name: "项目计划", exact: true }).click();
  await workspace.getByRole("heading",{name:"项目计划与真实节点回填",exact:true}).waitFor();
  const sms = workspace
    .locator("details")
    .filter({
      has: page.locator("summary").filter({ hasText: "短信通道与外发授权" }),
    })
    .first();
  await sms.locator("summary").first().click();
  await sms.getByText(/网关未配置，不能外发/).waitFor();
  assert.equal(
    await sms.getByRole("button", { name: "授权并排队发送" }).isEnabled(),
    false,
  );
  await sms
    .getByText(/结果未知，禁止盲目重发/)
    .first()
    .waitFor();
  pass(
    "Actual browser separates gateway states and blocks sending with gateway disabled",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  assert.ok(width.scroll <= width.client + 2, JSON.stringify(width));
  assert.deepEqual(errors, []);
  pass(
    "Non-AI workspace fits mobile viewport and has no browser runtime errors",
  );
  await fs.writeFile(
    "docs/agency/evidence/p6-browser.json",
    JSON.stringify(
      { time: new Date().toISOString(), checks, pageErrors: errors },
      null,
      2,
    ),
  );
} catch(error){const page=browser.contexts()[0]?.pages()[0];if(page)await fs.writeFile(".p0/p6-browser-failure.txt",await page.locator("body").innerText());throw error;
} finally {
  await browser.close();
}
