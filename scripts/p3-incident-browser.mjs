import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "/Users/note/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const s = JSON.parse(await fs.readFile(".p0/p3-incident-browser-session.json")),
  editor = JSON.parse(await fs.readFile(".p0/p3-opening-editor-session.json"));
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
async function workspace(user) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    timezoneId: "Asia/Shanghai",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (s) =>
      localStorage.setItem("24bid.tenant-portal.session", JSON.stringify(s)),
    user,
  );
  await page.goto(
    "http://127.0.0.1:15173/?module=agency&recordId=" + s.packageId,
  );
  await page.getByRole("tab", { name: "评审准备", exact: true }).click();
  const card = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: /评审异常控制浏览器验收/ }),
    })
    .first();
  await card.getByText("评审异常与暂停恢复", { exact: true }).click();
  const panel = card
    .locator("details")
    .filter({
      has: page.locator("summary").filter({ hasText: "评审异常与暂停恢复" }),
    })
    .last();
  return { page, panel };
}
try {
  const { page, panel } = await workspace(s),
    title = "浏览器异常暂停合成";
  await panel.getByText("登记评审异常", { exact: true }).click();
  await panel
    .getByLabel("异常类型", { exact: true })
    .selectOption("network_failure");
  await panel.getByLabel("异常标题", { exact: true }).fill(title);
  await panel
    .getByLabel("异常实际发生时间", { exact: true })
    .fill(local(Date.now() - 300000));
  await panel.getByLabel("异常责任人", { exact: true }).selectOption(s.userId);
  await panel
    .getByLabel("异常影响范围", { exact: true })
    .fill("合成本轮评审写入及后续价格复核");
  await panel
    .getByLabel("异常事实说明", { exact: true })
    .fill("仅冻结组织人员可读的合成异常明细，不代表实际问题");
  await panel
    .getByLabel("异常登记脱敏凭证", { exact: true })
    .selectOption(s.proofId);
  await panel.getByLabel("异常影响决定", { exact: true }).selectOption("pause");
  await panel
    .getByLabel("异常恢复或处理条件", { exact: true })
    .fill("核对合成故障排除、基线及全部异常处理条件");
  await panel
    .getByLabel("已核对异常事实、影响决定、责任人及处理条件", { exact: true })
    .check();
  let response = page.waitForResponse(
    (r) => r.url().endsWith("/incidents") && r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "登记异常并保留记录", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  await panel.getByText(/^本轮已暂停 · 控制版本 1$/).waitFor();
  await panel
    .getByLabel("轮次控制脱敏凭证", { exact: true })
    .selectOption(s.proofId);
  await panel
    .getByLabel("轮次控制决定及授权依据", { exact: true })
    .fill("合成恢复依据及全量异常复核，不放宽原有守卫");
  const check = panel.getByLabel("已核对本轮状态、全部异常及控制决定", {
    exact: true,
  });
  await check.check();
  assert.equal(
    await panel
      .getByRole("button", { name: "执行已复核的轮次控制", exact: true })
      .isDisabled(),
    true,
  );
  pass(
    "Browser registers a reviewed incident, pauses the round and prevents resume with an unresolved case",
  );
  const peer = await workspace(editor);
  await peer.panel.getByText(/^本轮已暂停/).waitFor();
  assert.equal(await peer.panel.getByText(title, { exact: false }).count(), 0);
  assert.equal(
    await peer.panel.getByText("登记评审异常", { exact: true }).count(),
    0,
  );
  assert.equal(
    await peer.panel.getByLabel("轮次控制操作", { exact: true }).count(),
    0,
  );
  await peer.panel.screenshot({ path: ".p0/p3-incident-reviewer-status.png" });
  pass(
    "A wildcard frozen reviewer sees neutral pause state and counts without private facts or control forms",
  );
  const incident = panel.getByRole("article", {
    name: "异常记录 " + title,
    exact: true,
  });
  await incident
    .getByLabel("异常实际处理时间 " + title, { exact: true })
    .fill(local(Date.now()));
  await incident
    .getByLabel("异常处理脱敏凭证 " + title, { exact: true })
    .selectOption(s.proofId);
  await incident
    .getByLabel("异常处理说明 " + title, { exact: true })
    .fill("合成故障已人工核对，继续条件已满足；结案不自动恢复");
  await incident
    .getByLabel("已核对本异常处理结果及条件 " + title, { exact: true })
    .check();
  response = page.waitForResponse(
    (r) => r.url().endsWith("/resolve") && r.request().method() === "POST",
  );
  await incident
    .getByRole("button", { name: "记录本异常处理结论", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  await panel.getByText(/^本轮已暂停 · 控制版本 2$/).waitFor();
  assert.equal(await check.isChecked(), false);
  assert.equal(
    await panel
      .getByLabel("轮次控制决定及授权依据", { exact: true })
      .inputValue(),
    "合成恢复依据及全量异常复核，不放宽原有守卫",
  );
  await check.check();
  response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/control/resume") && r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "执行已复核的轮次控制", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  await panel.getByText(/^本轮进行中 · 控制版本 3$/).waitFor();
  pass(
    "Case resolution keeps the round paused and invalidates prior control confirmation; separate re-review explicitly restores it",
  );
  await panel
    .getByLabel("轮次控制操作", { exact: true })
    .selectOption("terminate");
  await panel
    .getByLabel("轮次控制决定及授权依据", { exact: true })
    .fill("合成停止本轮决定，仅保留历史，不改变采购包状态或采购方式");
  await check.check();
  response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/control/terminate") && r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "执行已复核的轮次控制", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  await panel.getByText(/^本轮已停止，只读保留 · 控制版本 4$/).waitFor();
  assert.equal(
    await panel.getByText("登记评审异常", { exact: true }).count(),
    0,
  );
  assert.equal(await panel.getByLabel("轮次控制操作", { exact: true }).isDisabled(),true);
  assert.equal(
    await panel
      .getByRole("button", { name: "执行已复核的轮次控制", exact: true })
      .isDisabled(),
    true,
  );
  await panel.getByText("异常处理与控制历史（4）", { exact: true }).click();
  await panel.screenshot({ path: ".p0/p3-incident-workspace.png" });
  assert.equal(errors.length, 0);
  pass(
    "Explicit termination is irreversible, retains case/control history and leaves a read-only browser workspace without page exceptions",
  );
  await fs.writeFile(
    ".p0/p3-incident-browser-result.json",
    JSON.stringify(
      { passed: checks.length, checks, pageErrors: errors },
      null,
      2,
    ),
  );
  console.log("Incident/control browser passed:", checks.length, "checks");
} finally {
  await browser.close();
}
