import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "/Users/note/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const s = JSON.parse(await fs.readFile(".p0/p3-quote-browser-session.json"));
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
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
    .filter({ has: page.getByRole("heading", { name: /报价分层技术验收/ }) })
    .first();
  await card.getByText("独立评审任务", { exact: true }).click();
  await card.getByText("人工报价分层记录", { exact: true }).click();
  const panel = card
    .locator("details")
    .filter({
      has: page.locator("summary").filter({ hasText: "人工报价分层记录" }),
    })
    .last();
  await panel
    .getByLabel("报价对象", { exact: true })
    .selectOption(s.suppliers[1].id);
  const records = [];
  for (const [kind, amount] of [
    ["original", "0.00"],
    ["correction", "9.99"],
    ["policy", "8.88"],
    ["correction", "10.00"],
  ]) {
    await panel.getByLabel("报价层类型", { exact: true }).selectOption(kind);
    await panel.getByLabel("报价金额", { exact: true }).fill(amount);
    await panel
      .getByLabel("报价脱敏依据版本", { exact: true })
      .selectOption(s.proofId);
    await panel
      .getByLabel("报价核对说明", { exact: true })
      .fill("浏览器合成技术验证 " + kind);
    await panel
      .getByLabel("已核对本次价格层、最新版本及适用依据", { exact: true })
      .check();
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/quotes") && r.request().method() === "POST",
    );
    await panel
      .getByRole("button", { name: "追加报价记录并保留历史", exact: true })
      .click();
    const r = await response;
    assert.equal(r.status(), 200);
    records.push((await r.json()).data);
  }
  assert.equal(records[0].originalAmount, "0.00");
  assert.equal(records[2].evaluationAmount, "8.88");
  assert.equal(records[3].evaluationAmount, null);
  assert.equal(records[3].originalAmount, "0.00");
  await panel.getByText("8.88", { exact: true }).waitFor();
  await panel.locator("summary").scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".p0/p3-quote-workspace.png" });
  assert.equal(errors.length, 0);
  await fs.writeFile(
    ".p0/p3-quote-browser-result.json",
    JSON.stringify(
      {
        passed: 4,
        checks: [
          "zero original amount kept as decimal string",
          "correction appended",
          "policy price kept separate",
          "new correction invalidates current policy and preserves history",
        ],
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log("PASS 4 browser quote layer checks");
} finally {
  await browser.close();
}
