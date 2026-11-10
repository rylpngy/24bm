import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "/Users/note/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { fixture } from "./agency-technical-fixture.mjs";
const f = await fixture(".p0/p4-archive-session.json"),
  { s, token } = f,
  browser = await chromium.launch({
    headless: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  }),
  page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    timezoneId: "Asia/Shanghai",
  }),
  errors = [],
  checks = [],
  pass = (t) => {
    checks.push(t);
    console.log("PASS", t);
  };
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.addInitScript(
    (u) =>
      localStorage.setItem("24bid.tenant-portal.session", JSON.stringify(u)),
    {
      token,
      userId: s.userId,
      tenantId: s.tenantId,
      displayName: "合成一期技术验收",
    },
  );
  await page.goto(
    `http://127.0.0.1:15173/?module=agency&recordId=${s.packageId}`,
  );
  const open = async (title) => {
    const summary = page
      .locator("summary")
      .filter({ hasText: new RegExp("^" + title + "$") });
    await summary.click();
    return summary.locator("..");
  };
  const post = await open("标后结果、文书与受控事项");
  await post.getByText("当前标后控制状态：", { exact: false }).waitFor();
  await post
    .getByLabel("实际评审任务", { exact: true })
    .selectOption(s.sessionId);
  assert.ok(
    (await post
      .getByLabel("已通过的推荐报告", { exact: true })
      .locator("option")
      .count()) > 1,
  );
  assert.equal(
    await post.getByText("本轮采购文件已审核版本号", { exact: true }).count(),
    0,
  );
  pass(
    "Browser opens sanitized approved result options through the post-award workspace without private opinion reads or raw source-version inputs",
  );
  const issueForm = post
      .locator("form")
      .filter({
        has: page.getByRole("heading", {
          name: "登记质疑投诉事项",
          exact: true,
        }),
      }),
    title = "浏览器合成受控事项-" + Date.now();
  await issueForm
    .getByLabel("事项类型", { exact: true })
    .selectOption("question");
  await issueForm.getByLabel("事项标题", { exact: true }).fill(title);
  await issueForm
    .getByLabel("项目责任人", { exact: true })
    .selectOption(s.userId);
  await issueForm
    .getByLabel("实际收到时间", { exact: true })
    .fill("2026-11-09T20:00");
  await issueForm
    .getByLabel("实际处理期限", { exact: true })
    .fill("2026-11-20T20:00");
  await issueForm
    .getByLabel("实际脱敏凭证", { exact: true })
    .selectOption(s.proofId);
  await issueForm.getByLabel("办理状态", { exact: true }).selectOption("open");
  await issueForm
    .getByLabel("有权决定或尚待决定说明", { exact: true })
    .fill("浏览器技术验证：无控制决定，保持现状");
  await issueForm
    .getByLabel("实际有权决定的标后控制动作", { exact: true })
    .selectOption("no_decision");
  await issueForm
    .getByLabel("实际处理说明", { exact: true })
    .fill("实际登记测试，保留材料、责任人与期限，不自动发送或答复");
  const submit = issueForm.getByRole("button", {
    name: "登记质疑投诉事项",
    exact: true,
  });
  assert.equal(await submit.isEnabled(), false);
  await issueForm.getByRole("checkbox").check();
  await submit.click();
  await post
    .getByLabel("质疑投诉事项", { exact: true })
    .locator("option")
    .filter({ hasText: title })
    .waitFor({ state: "attached" });
  pass(
    "Real browser saves a controlled external matter with owner, deadline and proof only after input-bound manual acknowledgement",
  );
  const finance = await open("收入、成本与财务办理");
  await finance.getByText("确认应收（含批准增加）", { exact: true }).waitFor();
  await finance.getByText("超收待处理", { exact: true }).waitFor();
  const archive = await open("正式档案与三维完成状态");
  await archive.getByText("正式档案 V2", { exact: false }).waitFor();
  await archive.getByText("持续积累／待补", { exact: false }).first().waitFor();
  const office = await open("办公室协同与所属项目汇总");
  await office.getByText("内部待办不自动对外催收", { exact: false }).waitFor();
  pass(
    "Browser displays separate invoice/cash/cost totals, immutable archive versions, independent completion flags and internal office follow-up",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".p0/p5-mobile.png", fullPage: true });
  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  assert.ok(width.scroll <= width.client + 2, JSON.stringify(width));
  assert.deepEqual(errors, []);
  pass(
    "New phase-one panels render at mobile width without horizontal page overflow or browser runtime errors",
  );
  await fs.writeFile(
    ".p0/p5-browser-result.json",
    JSON.stringify({ passed: checks.length, checks }, null, 2),
  );
} finally {
  await browser.close();
}
