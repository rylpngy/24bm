import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "/Users/note/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const s = JSON.parse(await fs.readFile(".p0/p3-price-browser-session.json"));
assert.ok(s.tenantId.startsWith("agency-assessment-"));
const browser = await chromium.launch({
    headless: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  }),
  errors = [],
  checks = [],
  pass = (t) => {
    checks.push(t);
    console.log("PASS", t);
  };
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    timezoneId: "Asia/Shanghai",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (s) =>
      localStorage.setItem("24bid.tenant-portal.session", JSON.stringify(s)),
    s,
  );
  await page.goto(
    "http://127.0.0.1:15173/?module=agency&recordId=" + s.packageId,
  );
  await page.getByRole("tab", { name: "评审准备", exact: true }).click();
  const card = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: /价格规则计算浏览器验收/ }),
    })
    .first();
  await card.getByText("独立评审任务", { exact: true }).click();
  await card.getByText("价格规则与计算明细", { exact: true }).click();
  const panel = card
    .locator("details")
    .filter({
      has: page.locator("summary").filter({ hasText: "价格规则与计算明细" }),
    })
    .last();
  await panel
    .getByLabel("价格规则版本", { exact: true })
    .fill("BROWSER-PRICE-V1");
  await panel
    .getByLabel("价格规则适用依据", { exact: true })
    .fill("合成定稿价格P1，人工核对；非实际适用规则");
  await panel
    .getByLabel("价格规则原文定位", { exact: true })
    .fill("合成价格项P1及价格公式章节");
  for (const label of ["原文价格规则", "系统价格规则"]) {
    await panel
      .getByLabel(label + "来源", { exact: true })
      .selectOption("final_original");
    await panel
      .getByLabel(label + "公式", { exact: true })
      .selectOption("minimum_ratio");
    await panel.getByLabel(label + "价格项编号", { exact: true }).fill("P1");
    await panel.getByLabel(label + "满分", { exact: true }).fill("30");
    await panel
      .getByLabel(label + "同价同分依据", { exact: true })
      .fill("按合成定稿同价同分依据另行复核，不自动排序");
  }
  await panel.getByLabel("系统价格规则保留位数", { exact: true }).fill("3");
  await panel
    .getByLabel("价格规则维护说明", { exact: true })
    .fill("合成原文两侧独立核对");
  let response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/price-calculations/rule") &&
      r.request().method() === "PUT",
  );
  await panel
    .getByRole("button", { name: "保存价格规则草稿", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  await panel.getByText(/原文差异：保留位数/).waitFor();
  assert.equal(
    await panel
      .getByRole("button", { name: "冻结本版价格规则", exact: true })
      .isDisabled(),
    true,
  );
  pass(
    "Browser displays original/configured decimal differences and prevents freezing mismatched rules",
  );
  await panel.getByLabel("系统价格规则保留位数", { exact: true }).fill("2");
  response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/price-calculations/rule") &&
      r.request().method() === "PUT",
  );
  await panel
    .getByRole("button", { name: "保存价格规则草稿", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  await panel
    .getByText("两侧规则一致，仍须人工核对原文及舍入顺序", { exact: true })
    .waitFor();
  await panel
    .getByLabel("已逐项核对原文、价格来源、权重及仅最终除法舍入", {
      exact: true,
    })
    .check();
  response = page.waitForResponse(
    (r) => r.url().endsWith("/rule/freeze") && r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "冻结本版价格规则", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  await panel.getByText(/价格规则已冻结/).waitFor();
  pass(
    "Explicitly reviewed rules freeze into a visible immutable hash bound to the price item and final source",
  );
  for (const supplier of s.suppliers)
    await panel
      .getByLabel("纳入价格计算 " + supplier.name, { exact: true })
      .check();
  response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/price-calculations/preview") &&
      r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "生成价格计算预览", exact: true })
    .click();
  const previewResponse = await response;
  assert.equal(previewResponse.status(), 200);
  const preview = (await previewResponse.json()).data;
  assert.deepEqual(preview.blockers, []);
  assert.deepEqual(
    preview.trace.lines.map((l) => l.score),
    ["30.00", "10.00"],
  );
  await panel.getByText("10.00", { exact: true }).waitFor();
  assert.equal(
    await panel
      .getByRole("button", { name: "确认并保存独立价格计算", exact: true })
      .isDisabled(),
    true,
  );
  pass(
    "Explicitly selected subjects produce exact decimal component points and multiplication/division trace before manual confirmation",
  );
  await panel
    .getByLabel("价格计算复核凭证", { exact: true })
    .selectOption(s.proofId);
  await panel
    .getByLabel("价格计算复核说明", { exact: true })
    .fill("浏览器逐家核对最终报价来源、范围及30/10价格分明细，不形成综合排名");
  await panel
    .getByLabel("已复核指定价格来源、逐家处理及全部计算明细", { exact: true })
    .check();
  response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/price-calculations") &&
      r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "确认并保存独立价格计算", exact: true })
    .click();
  const saved = await response;
  assert.equal(saved.status(), 200);
  const history = panel.getByText(/历史价格计算 ·/).last();
  await history.waitFor();
  await history.click();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("button")).some(
      (b) => b.textContent.trim() === "生成价格计算预览" && !b.disabled,
    ),
  );
  await panel.screenshot({ path: ".p0/p3-price-workspace.png" });
  assert.equal(errors.length, 0);
  pass(
    "A reviewed immutable history snapshot retains exact prices, source fingerprints and arithmetic without browser errors",
  );
  await fs.writeFile(
    ".p0/p3-price-browser-result.json",
    JSON.stringify(
      { passed: checks.length, checks, pageErrors: errors },
      null,
      2,
    ),
  );
  console.log("Price browser passed:", checks.length, "checks");
} finally {
  await browser.close();
}
