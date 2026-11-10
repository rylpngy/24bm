import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "/Users/note/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const s = JSON.parse(
  await fs.readFile(".p0/p3-final-quote-browser-session.json"),
);
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
const local = (t) => {
  const d = new Date(t);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const fixture = ".p0/p3-final-quote-fixture.txt";
await fs.writeFile(fixture, "合成线下最终响应及最后报价0.00，仅供技术验证。");
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
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
      has: page.getByRole("heading", { name: /最后报价浏览器技术验收/ }),
    })
    .first();
  await card.getByText("独立评审任务", { exact: true }).click();
  await card.getByText("线下最后报价（谈判/磋商）", { exact: true }).click();
  const panel = card
    .locator("details")
    .filter({
      has: page
        .locator("summary")
        .filter({ hasText: "线下最后报价（谈判/磋商）" }),
    })
    .last();
  for (const supplier of s.suppliers)
    await panel
      .getByLabel("最后报价参与者 " + supplier.name, { exact: true })
      .check();
  const now = Date.now();
  await panel
    .getByLabel("最后报价实际发起时间", { exact: true })
    .fill(local(now - 3600000));
  await panel
    .getByLabel("最后报价截止时间", { exact: true })
    .fill(local(now - 300000));
  await panel
    .getByLabel("最后报价最终需求依据", { exact: true })
    .selectOption(s.proofId);
  await panel
    .getByLabel("最后报价发起及通知凭证", { exact: true })
    .selectOption(s.proofId);
  await panel
    .getByLabel("最后报价发起说明", { exact: true })
    .fill("合成线下发起与通知核对，最终需求和响应条件已有记录");
  await panel
    .getByLabel("已核对最终需求、最终响应条件、参与者及发起通知", {
      exact: true,
    })
    .check();
  let response = page.waitForResponse(
    (r) => r.url().endsWith("/final-quotes") && r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "锁定最后报价发起记录", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  pass(
    "Browser locks the real offline initiation, deadline, reviewed requirements and participants",
  );
  const [a, b] = s.suppliers;
  await panel.getByText("登记最终响应及最后报价", { exact: true }).click();
  await panel
    .getByLabel("最后报价接收对象", { exact: true })
    .selectOption(a.id);
  await panel
    .getByLabel("最后报价材料文件名", { exact: true })
    .fill("最终响应及报价合成.txt");
  await panel.getByLabel("最后报价金额", { exact: true }).fill("0.00");
  await panel
    .getByLabel("最后报价实际接收时间", { exact: true })
    .fill(local(now - 600000));
  await panel
    .getByLabel("最后报价来源及最终响应说明", { exact: true })
    .fill("合成电子副本，已人工核对最终响应；导入人不代表供应商身份");
  await panel
    .getByLabel("最后报价补录依据", { exact: true })
    .fill("合成线下实际接收时点核对后补录");
  response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/final-quotes/receipts") &&
      r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "建立最后报价接收登记", exact: true })
    .click();
  const received = await response;
  assert.equal(received.status(), 200);
  assert.equal((await received.json()).data.receipt.amount, "0.00");
  const receipt = panel.getByRole("article", {
    name: "最后报价接收 " + a.name,
    exact: true,
  });
  await receipt.waitFor();
  assert.equal(
    await panel
      .getByRole("button", { name: "下载已确认最后报价材料", exact: true })
      .count(),
    0,
  );
  for (const [supplier, status, reason] of [
    [a, "accepted", "合成最终响应及零元最后报价按时接收，已核对"],
    [b, "not_submitted", "未提交最后报价；不复制首次报价，后续按规则另行处理"],
  ]) {
    await panel
      .getByLabel("最后报价处理 " + supplier.name, { exact: true })
      .selectOption(status);
    await panel
      .getByLabel("最后报价处理依据 " + supplier.name, { exact: true })
      .fill(reason);
  }
  await panel
    .getByLabel("最后报价确认凭证", { exact: true })
    .selectOption(s.proofId);
  await panel
    .getByLabel("最后报价确认及后续处理说明", { exact: true })
    .fill("本次仅确认最后报价记录；缺失对象已按依据记录，不自动继续或推荐");
  const checked = panel.getByLabel(
    "已逐家核对最终响应、实际接收时点及异常处理",
    { exact: true },
  );
  await checked.check();
  response = page.waitForResponse(
    (r) => r.url().endsWith("/seal") && r.request().method() === "POST",
  );
  await receipt
    .getByLabel("上传最后报价材料 " + a.name, { exact: true })
    .setInputFiles(fixture);
  assert.equal((await response).status(), 200);
  await receipt.getByText("已检查封存", { exact: false }).waitFor();
  await page.waitForFunction(() => {
    const input = Array.from(document.querySelectorAll("label"))
      .find((l) =>
        l.textContent.includes("已逐家核对最终响应、实际接收时点及异常处理"),
      )
      ?.querySelector("input");
    return input && !input.checked;
  });
  assert.equal(
    await panel
      .getByLabel("最后报价处理依据 " + b.name, { exact: true })
      .inputValue(),
    "未提交最后报价；不复制首次报价，后续按规则另行处理",
  );
  pass(
    "Uploading sealed final-response bytes invalidates earlier confirmation while preserving manual missing-submission handling",
  );
  await checked.check();
  response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/final-quotes/confirm") &&
      r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "确认最后报价及逐家处理并锁定", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  await panel.getByText("未形成有效最后报价", { exact: true }).waitFor();
  await panel.getByText("0.00 CNY", { exact: true }).waitFor();
  assert.equal(
    await panel
      .getByRole("button", { name: "建立最后报价接收登记", exact: true })
      .count(),
    0,
  );
  pass(
    "The browser confirms an exact zero final price and records another subject as missing without a fallback amount",
  );
  const dl = page.waitForEvent("download");
  await panel
    .getByRole("button", { name: "下载已确认最后报价材料", exact: true })
    .click();
  const download = await dl;
  await download.saveAs(".p0/p3-final-quote-downloaded.txt");
  assert.deepEqual(
    await fs.readFile(".p0/p3-final-quote-downloaded.txt"),
    await fs.readFile(fixture),
  );
  await panel.screenshot({ path: ".p0/p3-final-quote-workspace.png" });
  assert.equal(errors.length, 0);
  pass(
    "Only the confirmed accepted response downloads exact sealed bytes; no browser exceptions",
  );
  await fs.writeFile(
    ".p0/p3-final-quote-browser-result.json",
    JSON.stringify(
      { passed: checks.length, checks, pageErrors: errors },
      null,
      2,
    ),
  );
  console.log("Final quote browser passed:", checks.length, "checks");
} finally {
  await browser.close();
}
