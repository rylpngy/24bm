import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "/Users/note/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const s = JSON.parse(
  await fs.readFile(".p0/p3-final-response-browser-session.json"),
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
async function refresh(u) {
  const r = await fetch("http://127.0.0.1:18080/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      account: u.userId + "@example.com",
      password: "demo123456",
      scope: "BUYER",
      tenantId: u.tenantId,
    }),
  });
  assert.equal(r.status, 200);
  u.token = (await r.json()).data.accessToken;
}
for (const u of [s, ...s.reviewers]) await refresh(u);
async function call(path, u = s) {
  const r = await fetch("http://127.0.0.1:18080/api/v1/buyer/agency" + path, {
    headers: { authorization: "Bearer " + u.token },
  });
  assert.equal(r.status, 200);
  return (await r.json()).data;
}
async function open(u) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
    timezoneId: "Asia/Shanghai",
    acceptDownloads: true,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (u) =>
      localStorage.setItem("24bid.tenant-portal.session", JSON.stringify(u)),
    u,
  );
  await page.goto(
    "http://127.0.0.1:15173/?module=agency&recordId=" + s.packageId,
  );
  await page.getByRole("tab", { name: "评审准备", exact: true }).click();
  const card = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: /最终响应独立复核浏览器验收/ }),
    })
    .first();
  await card.getByText("独立评审任务", { exact: true }).click();
  await card.getByText("最终响应复核与方式分支", { exact: true }).click();
  const panel = card
    .locator("summary")
    .filter({ hasText: /^最终响应复核与方式分支$/ })
    .locator("..");
  return { page, panel };
}
try {
  const org = await open(s);
  await org.panel
    .getByLabel("最终响应复核组织凭证", { exact: true })
    .selectOption(s.proofId);
  await org.panel
    .getByLabel("最终响应复核组织说明", { exact: true })
    .fill("合成最终需求、精确材料和全部评审职责核对，未修改原规则");
  await org.panel.getByLabel(/已核对最终需求、精确响应副本/).check();
  await org.panel
    .getByRole("button", { name: "冻结最终响应复核", exact: true })
    .click();
  await org.panel.getByText(/复核依据SHA256/).waitFor();
  assert.equal(await org.panel.getByText(/本人最终响应独立意见/).count(), 0);
  const w = await call(s.root + "/final-response-review");
  assert.equal(w.snapshot.members.length, 2);
  pass(
    "Organizer freezes exact final requirements and response evidence with all frozen reviewers, while receiving progress rather than a personal review form",
  );
  const editor = s.reviewers[0],
    viewer = s.reviewers[1];
  let ed = await open(editor);
  const first = w.snapshot.subjects[0],
    criterion = w.snapshot.criteria.find((v) => v.key === "T1"),
    label = first.supplierName + " " + criterion.title;
  assert.equal(
    await ed.panel
      .getByLabel("最终响应分值 " + label, { exact: true })
      .inputValue(),
    "",
  );
  await ed.panel.getByLabel("最终响应分值 " + label, { exact: true }).fill("2");
  await ed.panel
    .getByLabel("最终响应意见 " + label, { exact: true })
    .fill("BROWSER-EDITOR-PRIVATE-PARTIAL");
  await ed.panel
    .getByRole("button", { name: "保存本人最终响应草稿", exact: true })
    .click();
  await ed.page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent === "保存本人最终响应草稿",
      )?.disabled,
  );
  await ed.page.close();
  ed = await open(editor);
  assert.equal(
    await ed.panel
      .getByLabel("最终响应意见 " + label, { exact: true })
      .inputValue(),
    "BROWSER-EDITOR-PRIVATE-PARTIAL",
  );
  const vi = await open(viewer);
  assert.equal(
    await vi.panel
      .getByLabel("最终响应分值 " + label, { exact: true })
      .inputValue(),
    "",
  );
  assert.ok(
    !(await vi.panel.innerText()).includes("BROWSER-EDITOR-PRIVATE-PARTIAL"),
  );
  pass(
    "Final opinions start empty, partial private facts survive save/reopen, and another frozen reviewer cannot see or inherit them",
  );
  await vi.panel.getByText("冻结最终响应与条款对照", { exact: true }).click();
  const dl = vi.page.waitForEvent("download");
  await vi.panel
    .getByRole("button", {
      name: "下载" + first.supplierName + "最终响应",
      exact: true,
    })
    .click();
  const download = await dl;
  const path = await download.path();
  assert.match(await fs.readFile(path, "utf8"), /合成最后报价/);
  assert.equal(
    createHash("sha256")
      .update(await fs.readFile(path))
      .digest("hex"),
    first.responseHash,
  );
  pass(
    "A frozen reviewer downloads the exact accepted final-response attachment after plan activation rather than an unconfirmed receipt or an initial response",
  );
  async function fillAndSubmit(ctx, u, values, marker) {
    for (const [i, subject] of w.snapshot.subjects.entries())
      for (const c of w.snapshot.criteria) {
        const label = subject.supplierName + " " + c.title;
        if (c.resultType === "score")
          await ctx.panel
            .getByLabel("最终响应分值 " + label, { exact: true })
            .fill(c.key === "T1" ? values[i] : "0");
        else
          await ctx.panel
            .getByLabel("最终响应结论 " + label, { exact: true })
            .selectOption("pass");
        await ctx.panel
          .getByLabel("最终响应依据 " + label, { exact: true })
          .fill("实际最终响应第2页，对照共同需求");
        await ctx.panel
          .getByLabel("最终响应意见 " + label, { exact: true })
          .fill(marker);
      }
    await ctx.panel
      .getByRole("button", { name: "保存本人最终响应草稿", exact: true })
      .click();
    await ctx.panel
      .getByLabel("本人最终响应复核凭证", { exact: true })
      .selectOption(s.proofId);
    await ctx.panel.getByLabel(/已本人核对最终需求与实际响应/).check();
    await ctx.panel
      .getByRole("button", { name: "独立提交本人最终响应意见", exact: true })
      .click();
    await ctx.panel.getByText(/本人最终响应独立意见 · 已锁定/).waitFor();
    const mine = await call(s.root + "/final-response-review/mine", u);
    assert.equal(mine.sheet.status, "submitted");
    assert.ok(
      JSON.parse(mine.sheet.entriesJson).every((v) => v.opinion === marker),
    );
  }
  await fillAndSubmit(vi, viewer, ["4", "6"], "BROWSER-VIEWER-PRIVATE-FINAL");
  let price = await call(s.root + "/price-calculations");
  assert.ok(
    price.blockers.some((v) => v.includes("最终响应独立复核尚未全部提交")),
  );
  await fillAndSubmit(ed, editor, ["2", "4"], "BROWSER-EDITOR-PRIVATE-FINAL");
  await ed.panel.getByText(/本人提交SHA256/).waitFor();
  assert.equal(
    await ed.panel
      .getByRole("button", { name: "保存本人最终响应草稿", exact: true })
      .count(),
    0,
  );
  await ed.panel
    .locator("section")
    .first()
    .screenshot({ path: ".p0/p3-final-response-mine.png" });
  pass(
    "Each reviewer completes and locks every final requirement and frozen scoring item; one outstanding member blocks computation and submitted forms become read-only",
  );
  await org.page.close();
  const done = await open(s);
  for (const member of w.snapshot.members)
    await done.panel
      .getByText(member.name + "：已独立提交", { exact: true })
      .waitFor();
  assert.ok(
    !(await done.panel.innerText()).includes("BROWSER-EDITOR-PRIVATE-FINAL"),
  );
  assert.ok(
    !(await done.panel.innerText()).includes("BROWSER-VIEWER-PRIVATE-FINAL"),
  );
  await done.panel.screenshot({ path: ".p0/p3-final-response-progress.png" });
  assert.deepEqual(errors, []);
  pass(
    "Organizer sees all members completed without their private opinions; browser page errors remain zero",
  );
  await fs.writeFile(
    ".p0/p3-final-response-browser-result.json",
    JSON.stringify(
      { passed: checks.length, checks, pageErrors: errors },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
