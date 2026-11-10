import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "/Users/note/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const s = JSON.parse(
    await fs.readFile(".p0/p3-discussion-browser-session.json"),
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
  },
  local = (t) => {
    const d = new Date(t);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
async function open(user) {
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
      has: page.getByRole("heading", { name: /逐家沟通过程浏览器验收/ }),
    })
    .first();
  await card.getByText("独立评审任务", { exact: true }).click();
  return { page, card };
}
try {
  const { page, card } = await open(s);
  await card.getByText("逐家谈判／磋商过程", { exact: true }).click();
  const panel = card
    .locator("details")
    .filter({
      has: page.locator("summary").filter({ hasText: "逐家谈判／磋商过程" }),
    })
    .last();
  await panel
    .getByLabel("逐家沟通启用凭证", { exact: true })
    .selectOption(s.proofId);
  await panel
    .getByLabel("逐家沟通启用依据", { exact: true })
    .fill("合成线下逐家沟通范围、角色及定稿规则核对，非实际采购依据");
  await panel
    .getByLabel("已核对逐家沟通适用方式、对象及依据", { exact: true })
    .check();
  let response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/discussions/activate") &&
      r.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "启用并锁定逐家沟通范围", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  const [a, b] = s.suppliers;
  await panel.getByLabel("沟通对象", { exact: true }).selectOption(a.id);
  let region = panel.getByRole("region", {
    name: "逐家沟通 " + a.name,
    exact: true,
  });
  await region.getByText("追加本对象沟通草稿", { exact: true }).click();
  await region
    .getByLabel("逐家沟通正文", { exact: true })
    .fill("浏览器甲专属私有沟通正文");
  await region
    .getByLabel("沟通草稿维护说明", { exact: true })
    .fill("合成部分草稿先保存，不能自动确认");
  assert.equal(
    await panel.getByLabel("沟通对象", { exact: true }).isDisabled(),
    true,
  );
  response = page.waitForResponse(
    (r) => r.url().endsWith("/draft") && r.request().method() === "PUT",
  );
  await region
    .getByRole("button", { name: "保存本对象沟通草稿", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  pass(
    "Browser activates an explicit scope and retains a partial private draft; switching is disabled until save or explicit discard",
  );
  await panel.getByLabel("沟通对象", { exact: true }).selectOption(b.id);
  region = panel.getByRole("region", {
    name: "逐家沟通 " + b.name,
    exact: true,
  });
  await region.getByText("追加本对象沟通草稿", { exact: true }).click();
  assert.equal(
    await region.getByLabel("逐家沟通正文", { exact: true }).inputValue(),
    "",
  );
  assert.ok(!(await region.innerText()).includes("浏览器甲专属私有沟通正文"));
  async function fillAndConfirm(region, name, index, text) {
    await region
      .getByLabel("沟通开始时间", { exact: true })
      .fill(local(Date.parse(s.openedAt) + (10 + index * 10) * 60000));
    await region
      .getByLabel("沟通结束时间", { exact: true })
      .fill(local(Date.parse(s.openedAt) + (15 + index * 10) * 60000));
    await region.getByLabel("沟通工作人员 P1 creator", { exact: true }).check();
    await region.getByLabel("沟通工作人员 P1 editor", { exact: true }).check();
    await region
      .getByLabel("供应商实际出席人员及身份来源", { exact: true })
      .fill("合成线下代表，授权及签认来源已人工核对，不是在线认证");
    await region
      .getByLabel("沟通议题", { exact: true })
      .fill("本对象技术与履行方案核对");
    await region.getByLabel("逐家沟通正文", { exact: true }).fill(text);
    await region
      .getByLabel("供应商回应", { exact: true })
      .fill(name + "合成私有回应");
    await region
      .getByLabel("本次沟通结论", { exact: true })
      .fill("本次未涉及需求调整；不代替实质响应判断");
    await region
      .getByLabel("逐家沟通过程凭证", { exact: true })
      .selectOption(s.proofId);
    await region
      .getByLabel("沟通草稿维护说明", { exact: true })
      .fill("合成完整过程核对");
    let response = page.waitForResponse(
      (r) => r.url().endsWith("/draft") && r.request().method() === "PUT",
    );
    await region
      .getByRole("button", { name: "保存本对象沟通草稿", exact: true })
      .click();
    assert.equal((await response).status(), 200);
    const row = region.getByRole("article", {
      name: name + " 第1次沟通记录",
      exact: true,
    });
    await row
      .getByLabel("第1次沟通线下确认凭证", { exact: true })
      .selectOption(s.proofId);
    await row
      .getByLabel("第1次沟通线下确认情况", { exact: true })
      .fill("已按线下确认材料人工核对，不代表电子签署或供应商在线身份");
    await row
      .getByLabel("已核对本对象第1次实际沟通及线下确认凭证", { exact: true })
      .check();
    response = page.waitForResponse(
      (r) => r.url().endsWith("/confirm") && r.request().method() === "POST",
    );
    await row
      .getByRole("button", { name: "确认本次沟通并锁定", exact: true })
      .click();
    const confirmed = await response;
    assert.equal(confirmed.status(), 200);
    return (await confirmed.json()).data;
  }
  const rb = await fillAndConfirm(
    region,
    b.name,
    1,
    "浏览器乙专属私有沟通正文",
  );
  assert.equal(rb.status, "confirmed");
  pass(
    "Selecting another supplier starts a separate ledger with no carried-over text, and confirms only that supplier record",
  );
  await panel.getByLabel("沟通对象", { exact: true }).selectOption(a.id);
  region = panel.getByRole("region", {
    name: "逐家沟通 " + a.name,
    exact: true,
  });
  await region.getByText("续写本对象沟通草稿", { exact: true }).click();
  await region.getByLabel("逐家沟通正文", { exact: true }).waitFor();
  assert.equal(
    await region.getByLabel("逐家沟通正文", { exact: true }).inputValue(),
    "浏览器甲专属私有沟通正文",
  );
  const ra = await fillAndConfirm(
    region,
    a.name,
    0,
    "浏览器甲专属私有沟通正文",
  );
  assert.equal(ra.status, "confirmed");
  assert.ok(ra.frozenHash);
  pass(
    "Returning to the first supplier restores its saved draft and freezes staff/subject/evidence snapshots after explicit confirmation",
  );
  await card.getByText("线下最后报价（谈判/磋商）", { exact: true }).click();
  const finalPanel = card
    .locator("details")
    .filter({
      has: page
        .locator("summary")
        .filter({ hasText: "线下最后报价（谈判/磋商）" }),
    })
    .last();
  for (const supplier of s.suppliers)
    await finalPanel
      .getByLabel("最后报价参与者 " + supplier.name, { exact: true })
      .check();
  await finalPanel
    .getByLabel("最后报价实际发起时间", { exact: true })
    .fill(local(Date.now()));
  await finalPanel
    .getByLabel("最后报价截止时间", { exact: true })
    .fill(local(Date.now() + 3600000));
  await finalPanel
    .getByLabel("最后报价最终需求依据", { exact: true })
    .selectOption(s.proofId);
  await finalPanel
    .getByLabel("最后报价发起及通知凭证", { exact: true })
    .selectOption(s.proofId);
  await finalPanel
    .getByLabel("最后报价发起说明", { exact: true })
    .fill("合成实际逐家过程、最终需求条件与发起通知复核，不发送外部通知");
  await finalPanel
    .getByLabel("已核对最终需求、最终响应条件、参与者及发起通知", {
      exact: true,
    })
    .check();
  response = page.waitForResponse(
    (r) => r.url().endsWith("/final-quotes") && r.request().method() === "POST",
  );
  await finalPanel
    .getByRole("button", { name: "锁定最后报价发起记录", exact: true })
    .click();
  const finalStart = await response;
  assert.equal(finalStart.status(), 200);
  const campaign = (await finalStart.json()).data,
    manifest = JSON.parse(campaign.discussionManifestJson);
  assert.equal(
    manifest.find((r) => r.participationId === a.id).frozenHash,
    ra.frozenHash,
  );
  assert.equal(
    manifest.find((r) => r.participationId === b.id).frozenHash,
    rb.frozenHash,
  );
  await finalPanel.getByText("逐家沟通引用版本", { exact: true }).click();
  await finalPanel.screenshot({ path: ".p0/p3-discussion-final-manifest.png" });
  await panel.getByText(/最后报价已发起，逐家沟通只读保留/).waitFor();
  const firstRecord = region.getByRole("article", {
    name: a.name + " 第1次沟通记录",
    exact: true,
  });
  await firstRecord.locator("summary").click();
  assert.ok(
    !(await firstRecord.innerText()).includes("浏览器乙专属私有沟通正文"),
  );
  await panel.screenshot({ path: ".p0/p3-discussion-workspace.png" });
  pass(
    "Final initiation freezes exact supplier discussion references and makes the process read-only without copying private notes into the campaign",
  );
  const peer = await open(editor);
  await peer.card.getByRole("heading").first().waitFor();
  assert.equal(
    await peer.card.getByText("逐家谈判／磋商过程", { exact: true }).count(),
    0,
  );
  assert.ok(
    !(await peer.card.innerText()).includes("浏览器甲专属私有沟通正文"),
  );
  assert.equal(errors.length, 0);
  pass(
    "A wildcard frozen reviewer has no organizer discussion workspace or private supplier notes, and no browser exceptions occur",
  );
  await fs.writeFile(
    ".p0/p3-discussion-browser-result.json",
    JSON.stringify(
      { passed: checks.length, checks, pageErrors: errors },
      null,
      2,
    ),
  );
  console.log("Supplier discussion browser passed:", checks.length, "checks");
} finally {
  await browser.close();
}
