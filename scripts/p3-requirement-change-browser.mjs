import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "/Users/note/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const s = JSON.parse(
    await fs.readFile(".p0/p3-requirement-change-browser-session.json"),
  ),
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
  },
  time = (minutes) => local(Date.parse(s.openedAt) + minutes * 60000);
async function call(path) {
  const r = await fetch("http://127.0.0.1:18080/api/v1/buyer/agency" + path, {
    headers: { authorization: "Bearer " + s.token },
  });
  assert.equal(r.status, 200);
  return (await r.json()).data;
}
async function open(u) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    timezoneId: "Asia/Shanghai",
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
      has: page.getByRole("heading", { name: /授权需求变更浏览器验收/ }),
    })
    .first();
  await card.getByText("独立评审任务", { exact: true }).click();
  return { page, card };
}
try {
  const { page, card } = await open(s);
  await card.getByText("授权需求变更与同步通知凭证", { exact: true }).click();
  const panel = card.locator("summary").filter({hasText:/^授权需求变更与同步通知凭证$/}).locator("..");
  await panel
    .getByLabel("原文条款定位", { exact: true })
    .fill("第3条合成交付内容");
  await panel
    .getByLabel("变更前共同内容", { exact: true })
    .fill("仅提交PDF报告");
  await panel
    .getByLabel("变更后共同内容", { exact: true })
    .fill("增加可编辑交付副本");
  await panel
    .getByLabel("外部有权确认人", { exact: true })
    .fill("合成采购人授权代表");
  await panel.getByLabel("确认人身份", { exact: true }).fill("书面授权代表");
  await panel
    .getByLabel("授权范围及来源", { exact: true })
    .fill("合成书面授权范围，仅技术交付内容");
  await panel
    .getByLabel("外部有权确认凭证", { exact: true })
    .selectOption(s.authorizationVersionId);
  await panel.getByLabel("外部实际确认时间", { exact: true }).fill(time(50));
  await panel
    .getByLabel("共同最终需求版本", { exact: true })
    .selectOption(s.requirementsVersionId);
  await panel
    .getByLabel("共同变更通知版本", { exact: true })
    .selectOption(s.noticeVersionId);
  await panel
    .getByLabel("同一批次实际通知时间", { exact: true })
    .fill(time(55));
  await panel
    .getByLabel("统一线下通知方式", { exact: true })
    .fill("合成同一批次书面签收");
  await panel
    .getByLabel("核定响应准备截止", { exact: true })
    .fill(local(Date.now() + 30 * 60000));
  await panel
    .getByLabel("授权及通知登记依据", { exact: true })
    .fill("合成外部授权及共同通知核对，不代替实际业务确认");
  await panel.getByLabel(/已核对外部授权及允许范围/).check();
  await panel
    .getByRole("button", { name: "确认登记授权变更", exact: true })
    .click();
  await panel.getByText("第1项授权变更 · 待逐家核对通知送达").waitFor();
  let w = await call(s.root + "/requirement-changes");
  assert.equal(w.changes[0].status, "authorized");
  assert.equal(JSON.parse(w.changes[0].snapshotJson).subjects.length, 2);
  pass(
    "Browser registers external authority, common requirements and notice as an immutable all-recipient batch without claiming purchaser approval or sending messages",
  );
  const [a, b] = s.suppliers.map((v) => v.id),
    select = panel.getByLabel("通知送达对象", { exact: true });
  await select.selectOption(a);
  await panel
    .getByLabel("实际接收人及身份来源", { exact: true })
    .fill("甲未保存的私有接收说明");
  assert.equal(await select.isDisabled(), true);
  await panel
    .getByRole("button", { name: "放弃本对象未保存的送达凭证" })
    .click();
  await select.selectOption(b);
  assert.equal(
    await panel
      .getByLabel("实际接收人及身份来源", { exact: true })
      .inputValue(),
    "",
  );
  await select.selectOption(a);
  const fillReceipt = async (recipient, minute, replacement = "") => {
    await panel
      .getByLabel("实际接收人及身份来源", { exact: true })
      .fill(recipient);
    await panel
      .getByLabel("实际接收通知时间", { exact: true })
      .fill(time(minute));
    await panel
      .getByLabel("本对象送达核对说明", { exact: true })
      .fill("人工核对同一共同通知内容及需求版本");
    await panel
      .getByLabel("本对象通知送达凭证", { exact: true })
      .selectOption(s.proofId);
    if (replacement)
      await panel
        .getByLabel("通知凭证更正依据", { exact: true })
        .fill(replacement);
    await panel.getByLabel(/已核对本对象收到同一冻结通知/).check();
    await panel
      .getByRole("button", { name: "保存本对象送达凭证", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector('[aria-label="实际接收人及身份来源"]')?.value ===
        "",
    );
  };
  await fillReceipt("甲合成接收代表", 60);
  await page.waitForTimeout(150);
  assert.equal(
    await panel
      .getByRole("button", { name: "锁定全部通知复核", exact: true })
      .isDisabled(),
    true,
  );
  await select.selectOption(b);
  assert.equal(
    await panel
      .getByLabel("实际接收人及身份来源", { exact: true })
      .inputValue(),
    "",
  );
  await fillReceipt("乙合成接收代表", 61);
  await page.waitForTimeout(150);
  pass(
    "Recipient drafts stay isolated; unsaved facts lock switching, explicit discard clears them, and incomplete delivery blocks reconciliation",
  );
  await select.selectOption(a);
  await fillReceipt(
    "甲合成经核对接收代表",
    62,
    "合成追加更正身份说明，原始登记保留",
  );
  w = await call(s.root + "/requirement-changes");
  assert.equal(w.receipts.length, 3);
  assert.equal(w.receipts.filter((v) => v.participationId === a).length, 2);
  await panel.getByText(/第1版送达凭证（历史保留）/).waitFor();
  await panel
    .getByLabel("通知统一复核凭证", { exact: true })
    .selectOption(s.proofId);
  await panel
    .getByLabel("通知统一复核说明", { exact: true })
    .fill("合成逐家复核同一通知内容及所有接收凭证");
  await panel.getByLabel(/已核对全部冻结对象均收到同一共同通知/).check();
  await panel
    .getByRole("button", { name: "锁定全部通知复核", exact: true })
    .click();
  await panel.getByText("第1项授权变更 · 全部通知已复核锁定").waitFor();
  assert.equal(
    await panel.getByLabel("通知送达对象", { exact: true }).count(),
    0,
  );
  w = await call(s.root + "/requirement-changes");
  assert.equal(w.changes[0].status, "notified");
  await panel.screenshot({ path: ".p0/p3-requirement-change-workspace.png" });
  pass(
    "Append-only receipt correction preserves history; explicit reconciliation freezes every latest receipt and removes mutation controls",
  );
  await card.getByText("线下最后报价（谈判/磋商）", { exact: true }).click();
  const final = card.locator("summary").filter({hasText:/^线下最后报价（谈判\/磋商）$/}).locator("..");
  for (const supplier of s.suppliers)
    await final
      .getByLabel("最后报价参与者 " + supplier.name, { exact: true })
      .check();
  await final
    .getByLabel("最后报价实际发起时间", { exact: true })
    .fill(local(Date.now() - 60000));
  await final
    .getByLabel("最后报价截止时间", { exact: true })
    .fill(local(Date.now() + 60 * 60000));
  await final
    .getByLabel("最后报价最终需求依据", { exact: true })
    .selectOption(s.requirementsVersionId);
  await final
    .getByLabel("最后报价发起及通知凭证", { exact: true })
    .selectOption(s.noticeVersionId);
  await final
    .getByLabel("最后报价发起说明", { exact: true })
    .fill("合成核对最新共同需求、逐家沟通、全部变更通知及最终响应准备时间");
  await final
    .getByLabel("已核对最终需求、最终响应条件、参与者及发起通知", {
      exact: true,
    })
    .check();
  await final
    .getByRole("button", { name: "锁定最后报价发起记录", exact: true })
    .click();
  await final
    .getByText("已封存的授权需求变更与通知完成引用", { exact: true })
    .waitFor();
  await final
    .getByText("已封存的授权需求变更与通知完成引用", { exact: true })
    .click();
  const campaign = (await call(s.root + "/final-quotes")).campaign;
  assert.deepEqual(JSON.parse(campaign.requirementChangesJson), [
    { id: w.changes[0].id, hash: w.changes[0].completionHash },
  ]);
  await final.screenshot({
    path: ".p0/p3-requirement-change-final-manifest.png",
  });
  pass(
    "Final initiation accepts only the notified requirements and seals the exact completed change hash for later review",
  );
  const { page: other, card: otherCard } = await open(editor);
  assert.equal(
    await otherCard
      .getByText("授权需求变更与同步通知凭证", { exact: true })
      .count(),
    0,
  );
  assert.ok(
    !(await other.locator("body").innerText()).includes("甲合成经核对接收代表"),
  );
  assert.deepEqual(errors, []);
  pass(
    "Ordinary frozen reviewers cannot see organizer change/receipt facts; no browser page exceptions occur",
  );
  await fs.writeFile(
    ".p0/p3-requirement-change-browser-result.json",
    JSON.stringify(
      { passed: checks.length, checks, pageErrors: errors },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
