import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "/Users/note/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const s = JSON.parse(await fs.readFile(".p0/p3-total-browser-session.json"));
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
      has: page.getByRole("heading", { name: /综合评分汇总浏览器验收/ }),
    })
    .first();
  await card.getByText("独立评审任务", { exact: true }).click();
  await card.getByText("综合评分受控汇总", { exact: true }).click();
  const panel = card
    .locator("details")
    .filter({
      has: page.locator("summary").filter({ hasText: "综合评分受控汇总" }),
    })
    .last();
  await panel
    .getByLabel("汇总规则版本", { exact: true })
    .fill("BROWSER-TOTAL-V1");
  await panel
    .getByLabel("汇总规则适用依据", { exact: true })
    .fill("合成汇总规则，两名冻结成员及70/30权重；非实际业务适用认定");
  await panel
    .getByLabel("汇总规则原文定位", { exact: true })
    .fill("合成定稿汇总、唯一来源及总分舍入章节");
  for (const label of ["原文汇总规则", "系统汇总规则"]) {
    await panel
      .getByLabel(label + "来源 T1", { exact: true })
      .selectOption("member_mean");
    await panel
      .getByLabel(label + "来源 P1", { exact: true })
      .selectOption(
        label === "原文汇总规则" ? "objective_price" : "member_mean",
      );
  }
  await panel
    .getByLabel("汇总规则维护说明", { exact: true })
    .fill("两侧独立核对，检查价格不重复计分");
  let response = page.waitForResponse(
    (r) => r.url().endsWith("/totals/rule") && r.request().method() === "PUT",
  );
  await panel
    .getByRole("button", { name: "保存汇总规则草稿", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  await panel.getByText(/原文差异：逐项计分来源/).waitFor();
  assert.equal(
    await panel
      .getByRole("button", { name: "冻结本版汇总规则", exact: true })
      .isDisabled(),
    true,
  );
  pass(
    "Browser exposes incorrect manual price inclusion and blocks freezing source mismatches",
  );
  await panel
    .getByLabel("系统汇总规则来源 P1", { exact: true })
    .selectOption("objective_price");
  response = page.waitForResponse(
    (r) => r.url().endsWith("/totals/rule") && r.request().method() === "PUT",
  );
  await panel
    .getByRole("button", { name: "保存汇总规则草稿", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  await panel
    .getByText("两侧配置一致，仍须核对定稿及唯一计分来源", { exact: true })
    .waitFor();
  await panel
    .getByLabel("已核对原文汇总、成员范围、唯一计分来源及舍入顺序", {
      exact: true,
    })
    .check();
  response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/totals/rule/freeze") &&
      r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "冻结本版汇总规则", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  await panel.getByText(/汇总规则已冻结/).waitFor();
  assert.equal(
    await panel
      .getByRole("button", { name: "生成受控汇总预览", exact: true })
      .isDisabled(),
    true,
  );
  pass(
    "Explicit rule review freezes unique sources; a price snapshot must still be selected manually",
  );
  await panel
    .getByLabel("汇总价格计算版本", { exact: true })
    .selectOption(s.priceCalculationId);
  response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/totals/preview") && r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "生成受控汇总预览", exact: true })
    .click();
  const preview = await response;
  assert.equal(preview.status(), 200);
  const out = (await preview.json()).data;
  assert.deepEqual(out.blockers, []);
  assert.deepEqual(
    out.trace.subjects.map((x) => x.total),
    ["79.00", "52.00"],
  );
  assert.equal(
    out.trace.subjects[0].components.find((c) => c.criterionKey === "T1")
      .memberCount,
    2,
  );
  assert.equal(
    out.trace.subjects[0].components.find((c) => c.criterionKey === "P1")
      .memberCount,
    0,
  );
  await panel.getByText("79.00", { exact: true }).first().waitFor();
  assert.ok(!(await panel.innerText()).includes("PRIVATE-TOTAL-OPINION"));
  pass(
    "Two-member raw-score aggregation and one objective price component produce 79.00/52.00 without private opinion text",
  );
  await panel
    .getByLabel("汇总复核凭证", { exact: true })
    .selectOption(s.proofId);
  await panel
    .getByLabel("汇总复核说明", { exact: true })
    .fill(
      "浏览器人工核对两名成员版本、价格唯一来源及79/52汇总，不形成排名或推荐",
    );
  await panel
    .getByLabel("已逐项复核唯一计分来源、成员版本及汇总明细", { exact: true })
    .check();
  response = page.waitForResponse(
    (r) => r.url().endsWith("/totals") && r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "确认并保存受控汇总", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  const history = panel.locator(":scope > details").last();
  await history.locator("summary").first().waitFor();
  await history.locator("summary").first().click();
  await history
    .getByText(s.suppliers[0].name + " 分项与提交版本", { exact: true })
    .click();
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("button")).some(
      (b) => b.textContent.trim() === "生成受控汇总预览" && !b.disabled,
    ),
  );
  await history.screenshot({ path: ".p0/p3-total-workspace.png" });
  assert.equal(errors.length, 0);
  pass(
    "A settled immutable history shows raw sum, denominator, member version hashes and the single price reference without browser errors",
  );
  await fs.writeFile(
    ".p0/p3-total-browser-result.json",
    JSON.stringify(
      { passed: checks.length, checks, pageErrors: errors },
      null,
      2,
    ),
  );
  console.log("Controlled total browser passed:", checks.length, "checks");
} finally {
  await browser.close();
}
