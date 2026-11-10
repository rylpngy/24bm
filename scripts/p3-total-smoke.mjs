import { prepareFinalResponseReview } from "./agency-final-response-support.mjs";
import { prepareSupplierDiscussions } from "./agency-discussion-support.mjs";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {
  prepareMaterialOpening,
  uploadReceiptVersion,
} from "./agency-material-opening-support.mjs";
const s = JSON.parse(await fs.readFile(".p0/p3-price-browser-session.json")),
  editor = JSON.parse(await fs.readFile(".p0/p3-opening-editor-session.json"));
assert.ok(s.tenantId.startsWith("agency-assessment-"));
const base = "http://127.0.0.1:18080",
  pkg = s.packageId,
  checks = [],
  pass = (t) => {
    checks.push(t);
    console.log("PASS", t);
  },
  headers = () => ({
    authorization: "Bearer " + s.token,
    "content-type": "application/json",
  });
async function call(path, method = "GET", body, token = s.token) {
  const r = await fetch(base + "/api/v1/buyer/agency" + path, {
    method,
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json();
  if (r.status !== 200) throw Error("failed: " + r.status + " " + j.message);
  return j.data;
}
const bad = (p, m, b, status = 400, token = s.token) =>
  assert.rejects(() => call(p, m, b, token), new RegExp("failed: " + status));
for (let i = 0; i < 120; i++) {
  try {
    if ((await fetch(base + "/actuator/health")).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
async function refresh(u) {
  const r = await fetch(base + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      account: u.userId + "@example.com",
      password: "demo123456",
      scope: "BUYER",
      tenantId: u.tenantId,
    }),
  });
  assert.equal(r.status, 200, "Synthetic login failed");
  const j = await r.json();
  u.token = (j.data || j).accessToken;
  assert.equal(typeof u.token, "string");
}
await refresh(s);
await refresh(editor);
const detail = await call("/packages/" + pkg);
assert.equal(detail.record.procurementMethod, "竞争性磋商");
const viewer = {
  userId: detail.members.find((m) => m.role === "VIEWER").userId,
  tenantId: s.tenantId,
};
await refresh(viewer);
for (const name of await fs.readdir(".p0"))
  if (name.includes("session") && name.endsWith(".json")) {
    try {
      const file = ".p0/" + name;
      const stored = JSON.parse(await fs.readFile(file));
      const u = [s, editor, viewer].find(
        (u) => u.userId === stored.userId && u.tenantId === stored.tenantId,
      );
      if (u && stored.token) {
        stored.token = u.token;
        await fs.writeFile(file, JSON.stringify(stored), { mode: 0o600 });
      }
    } catch {}
  }
const all = await call("/evaluation/packages/" + pkg + "/rounds"),
  template = all.rounds.find((r) => r.round.id === s.roundId);
assert.ok(template);
const [a, b] = s.suppliers.map((v) => v.id),
  scope = { participationIds: [a, b], exclusions: {} };
async function make(title) {
  const cfg = {
    ...template.config,
    title: title + " " + Date.now(),
    members: [
      { userId: s.userId, roles: ["organizer"] },
      { userId: editor.userId, roles: ["review_member"] },
      { userId: viewer.userId, roles: ["review_member"] },
    ],
  };
  let r = await call("/evaluation/packages/" + pkg + "/rounds", "POST", {
    expectedVersion: 0,
    config: cfg,
    reason: "汇总合成技术验证，独立轮次",
    idempotencyKey: crypto.randomUUID(),
  });
  r = await call(
    "/evaluation/packages/" + pkg + "/rounds/" + r.round.id + "/freeze",
    "POST",
    {
      expectedVersion: r.round.version,
      businessRulesReviewed: true,
      reason: "核对合成70/30及两名成员职责",
      idempotencyKey: crypto.randomUUID(),
    },
  );
  const opened = await prepareMaterialOpening({
    call,
    headers,
    pkg,
    round: r.round.id,
    participantIds: [a, b],
    proofId: s.proofId,
    clock: Date.now() - 7200000,
  });
  const session = await call(
    "/evaluation/packages/" + pkg + "/rounds/" + r.round.id + "/assessment",
    "POST",
    {
      expectedRoundVersion: r.round.version,
      participationIds: [a, b],
      openingEvidenceVersionId: s.proofId,
      openedAt: opened.opening.openedAt,
      openingReviewed: true,
      note: "合成受控汇总技术验收",
      idempotencyKey: crypto.randomUUID(),
    },
  );
  return {
    roundId: r.round.id,
    sessionId: session.id,
    root: "/evaluation/packages/" + pkg + "/sessions/" + session.id,
  };
}
async function submit(f, u, technical, manualPrice) {
  const p = f.root + "/mine?stage=evaluation";
  let m = await call(p, "GET", undefined, u.token);
  const entries = s.suppliers.flatMap((v, i) =>
    ["T1", "P1"].map((key) => ({
      participationId: v.id,
      criterionKey: key,
      score: key === "T1" ? technical[i] : manualPrice[i],
      conclusion: null,
      evidence: "合成材料页码",
      opinion: "PRIVATE-TOTAL-OPINION-" + u.userId,
    })),
  );
  await call(
    p,
    "PUT",
    {
      expectedVersion: m.sheets[0].version,
      entries,
      idempotencyKey: crypto.randomUUID(),
    },
    u.token,
  );
  m = await call(p, "GET", undefined, u.token);
  await call(
    f.root + "/mine/submit?stage=evaluation",
    "POST",
    {
      expectedVersion: m.sheets[0].version,
      personallyConfirmed: true,
      idempotencyKey: crypto.randomUUID(),
    },
    u.token,
  );
}
async function final(f, values) {
  const discussionFingerprint = await prepareSupplierDiscussions({
    call,
    root: f.root,
    proofId: s.proofId,
    participantIds: [a, b],
  });
  const p = f.root + "/final-quotes",
    now = Date.now();
  await call(p, "POST", {
    discussionFingerprint,
    participationIds: [a, b],
    exclusions: {},
    initiatedAt: new Date(now - 3600000).toISOString(),
    cutoffAt: new Date(now - 60000).toISOString(),
    requirementsVersionId: s.proofId,
    noticeVersionId: s.proofId,
    reviewed: true,
    reason: "合成最终需求和最后报价发起通知核对",
    idempotencyKey: crypto.randomUUID(),
  });
  const decisions = [];
  for (const [i, id] of [a, b].entries()) {
    const row = await call(p + "/receipts", "POST", {
      participationId: id,
      fileName: "汇总最终响应合成.txt",
      amount: values[i],
      currency: "CNY",
      receivedAt: new Date(now - 120000).toISOString(),
      originalType: "electronic_copy",
      sourceNote: "合成最终响应及最后报价副本，不代表供应商身份",
      lateEntryReason: "已人工核对真实接收时点的合成补录",
      idempotencyKey: crypto.randomUUID(),
    });
    await uploadReceiptVersion(
      row.file.versions[0].id,
      "汇总最终响应合成.txt",
      "合成最后报价 " + values[i],
      headers,
    );
    decisions.push({
      participationId: id,
      receiptId: row.receipt.id,
      status: "accepted",
      reason: "已核对合成按时接收最终响应及报价",
    });
  }
  const w = await call(p);
  await call(p + "/confirm", "POST", {
    expectedVersion: w.campaign.version,
    receiptFingerprint: w.receiptFingerprint,
    decisions,
    evidenceVersionId: s.proofId,
    reviewed: true,
    note: "合成最终报价逐家核对",
    idempotencyKey: crypto.randomUUID(),
  });
}
const pr = {
  priceSource: "final_original",
  formula: "minimum_ratio",
  criterionKey: "P1",
  fullScore: "30",
  scale: 2,
  rounding: "HALF_UP",
  tieRule: "按合成定稿另行处理同价，不排序",
};
async function price(f, freezeRule = true) {
  await prepareFinalResponseReview({
    call,
    root: f.root,
    proofId: s.proofId,
    tokens: {
      [s.userId]: s.token,
      [editor.userId]: editor.token,
      [viewer.userId]: viewer.token,
    },
  });
  const p = f.root + "/price-calculations";
  if (freezeRule) {
    let r = await call(p + "/rule", "PUT", {
      expectedVersion: 0,
      config: {
        ruleVersion: "TOTAL-PRICE-V1",
        basis: "合成客观价格分依据",
        locator: "合成价格P1",
        documentRule: pr,
        configuredRule: pr,
      },
      reason: "合成价格规则核对",
      idempotencyKey: crypto.randomUUID(),
    });
    await call(p + "/rule/freeze", "POST", {
      expectedVersion: r.version,
      reviewed: true,
      reason: "已核对合成价格权重和舍入",
      idempotencyKey: crypto.randomUUID(),
    });
  }
  const preview = await call(p + "/preview", "POST", scope);
  assert.deepEqual(preview.blockers, []);
  return call(p, "POST", {
    scope,
    fingerprint: preview.fingerprint,
    evidenceVersionId: s.proofId,
    reviewed: true,
    reason: "合成价格范围及全部明细复核",
    idempotencyKey: crypto.randomUUID(),
  });
}
const rule = (patch = {}) => ({
  method: "mean_raw_then_weight",
  totalScale: 2,
  totalRounding: "HALF_UP",
  tieHandling: "manual_pending",
  sources: [
    { criterionKey: "T1", source: "member_mean" },
    { criterionKey: "P1", source: "objective_price" },
  ],
  ...patch,
});
const cfg = (a = rule(), b = rule()) => ({
  ruleVersion: "TOTAL-V1",
  basis: "合成定稿汇总规则，非实际业务适用认定",
  locator: "合成汇总与最终舍入章节",
  documentRule: a,
  configuredRule: b,
});
const save = (config, v = 0) => ({
  expectedVersion: v,
  config,
  reason: "合成逐项来源及舍入核对",
  idempotencyKey: crypto.randomUUID(),
});
const freeze = (r) => ({
  expectedVersion: r.version,
  reviewed: true,
  reason: "原文、全部冻结成员、唯一来源和舍入顺序已核对",
  idempotencyKey: crypto.randomUUID(),
});
const confirm = (p, id) => ({
  priceCalculationId: id,
  fingerprint: p.fingerprint,
  evidenceVersionId: s.proofId,
  reviewed: true,
  reason: "人工复核合成成员版本、唯一来源和汇总；不形成排名或推荐",
  idempotencyKey: crypto.randomUUID(),
});
const f = await make("受控汇总接口验收"),
  path = f.root + "/totals";
await bad(path, "GET", undefined, 403, editor.token);
await bad(
  "/evaluation/packages/foreign/sessions/" + f.sessionId + "/totals",
  "GET",
  undefined,
  403,
);
assert.equal((await call(path)).rule, null);
await submit(f, editor, ["8", "8"], ["100", "0"]);
await final(f, ["100.00", "300.00"]);
let pending = await call(f.root + "/price-calculations/preview", "POST", scope);
assert.ok(pending.blockers.some((x) => x.includes("独立意见尚未全部提交")));
await submit(f, viewer, ["6", "4"], ["0", "100"]);
let ps = await price(f);
let p = await call(path + "/preview", "POST", { priceCalculationId: ps.id });
assert.equal(p.trace, null);
assert.ok(p.blockers.includes("汇总规则尚未冻结"));
pass(
  "Frozen organizer and project scope apply; missing member submissions and unfrozen total rules cannot yield totals",
);
let row = await call(
  path + "/rule",
  "PUT",
  save(cfg(rule(), rule({ totalScale: 3 }))),
);
assert.deepEqual((await call(path)).differences, ["总分保留位数"]);
await bad(path + "/rule/freeze", "POST", freeze(row));
await bad(path + "/rule", "PUT", save(cfg(), 999), 409);
await bad(
  path + "/rule",
  "PUT",
  save(cfg(rule({ method: "drop_high_low" })), row.version),
);
await bad(
  path + "/rule",
  "PUT",
  save(cfg(rule({ tieHandling: "supplier_id" })), row.version),
);
pass(
  "Independent source/configuration differences, stale drafts, unsupported trimming and automatic tie breaking are rejected",
);
const allManual = rule({
  sources: [
    { criterionKey: "T1", source: "member_mean" },
    { criterionKey: "P1", source: "member_mean" },
  ],
});
row = await call(
  path + "/rule",
  "PUT",
  save(cfg(allManual, allManual), row.version),
);
await bad(path + "/rule/freeze", "POST", freeze(row));
await bad(
  path + "/rule",
  "PUT",
  save(
    cfg(
      rule({
        sources: [
          { criterionKey: "T1", source: "member_mean" },
          { criterionKey: "T1", source: "objective_price" },
        ],
      }),
    ),
    row.version,
  ),
);
const missing = rule({
  sources: [{ criterionKey: "P1", source: "objective_price" }],
});
row = await call(
  path + "/rule",
  "PUT",
  save(cfg(missing, missing), row.version),
);
await bad(path + "/rule/freeze", "POST", freeze(row));
row = await call(path + "/rule", "PUT", save(cfg(), row.version));
await bad(path + "/rule/freeze", "POST", { ...freeze(row), reviewed: false });
const fr = freeze(row);
row = await call(path + "/rule/freeze", "POST", fr);
assert.equal(
  (await call(path + "/rule/freeze", "POST", fr)).frozenHash,
  row.frozenHash,
);
await bad(path + "/rule", "PUT", save(cfg(), row.version));
assert.equal(JSON.parse(row.frozenJson).priceRuleHash, ps.ruleHash);
pass(
  "Exactly one objective price source and complete frozen criterion coverage are required by an immutable reviewed rule",
);
await bad(path + "/preview", "POST", { priceCalculationId: null });
await bad(
  "/evaluation/packages/" +
    pkg +
    "/sessions/" +
    s.sessionId +
    "/totals/preview",
  "POST",
  { priceCalculationId: ps.id },
);
p = await call(path + "/preview", "POST", { priceCalculationId: ps.id });
assert.deepEqual(p.blockers, []);
assert.deepEqual(
  p.trace.subjects.map((x) => x.total),
  ["79.00", "52.00"],
);
assert.deepEqual(
  p.trace.subjects.map(
    (x) => x.components.find((c) => c.criterionKey === "T1").rawSum,
  ),
  ["14", "12"],
);
for (const subject of p.trace.subjects) {
  const technical = subject.components.find((c) => c.criterionKey === "T1"),
    price = subject.components.find((c) => c.criterionKey === "P1");
  assert.equal(technical.memberCount, 2);
  assert.deepEqual(
    new Set(technical.references.map((r) => r.userId)),
    new Set([editor.userId, viewer.userId]),
  );
  assert.equal(price.memberCount, 0);
  assert.equal(price.rawSum, null);
  assert.equal(price.references[0].id, ps.id);
}
assert.ok(!JSON.stringify(p).includes("PRIVATE-TOTAL-OPINION"));
assert.ok(!JSON.stringify(await call(path)).includes("PRIVATE-TOTAL-OPINION"));
pass(
  "All two-member technical submissions produce 49/42; price is counted once as 30/10 despite contradictory manual price scores, without exposing private opinions",
);
await bad(path, "POST", { ...confirm(p, ps.id), reviewed: false });
await bad(path, "POST", { ...confirm(p, ps.id), fingerprint: "stale" }, 409);
await bad(path, "POST", { ...confirm(p, ps.id), evidenceVersionId: null });
const body = confirm(p, ps.id),
  saved = await call(path, "POST", body);
assert.equal((await call(path, "POST", body)).id, saved.id);
assert.equal((await call(path)).history.length, 1);
assert.deepEqual(
  JSON.parse(saved.traceJson).subjects.map((x) => x.total),
  ["79.00", "52.00"],
);
pass(
  "Manual review, sealed evidence and exact current fingerprint protect an idempotent immutable total snapshot",
);
const quotePath = f.root + "/quotes";
let original = await call(quotePath, "POST", {
  participationId: a,
  kind: "original",
  amount: "500.00",
  currency: "CNY",
  evidenceVersionId: s.proofId,
  reason: "合成初次价修订使输入版本变化，不替代最后报价",
  reviewed: true,
  idempotencyKey: crypto.randomUUID(),
});
await call(quotePath, "POST", {
  participationId: a,
  expectedPreviousId: original.id,
  kind: "correction",
  amount: "499.00",
  currency: "CNY",
  evidenceVersionId: s.proofId,
  reason: "合成版本变化复核",
  reviewed: true,
  idempotencyKey: crypto.randomUUID(),
});
let w = await call(path);
assert.equal(w.history[0].stale, true);
assert.deepEqual(
  JSON.parse(w.history[0].snapshot.traceJson).subjects.map((x) => x.total),
  ["79.00", "52.00"],
);
const stale = await call(path + "/preview", "POST", {
  priceCalculationId: ps.id,
});
assert.equal(stale.trace, null);
assert.ok(stale.blockers.some((x) => x.includes("价格计算已失效")));
await bad(
  path,
  "POST",
  { ...confirm(p, ps.id), idempotencyKey: crypto.randomUUID() },
  409,
);
ps = await price(f, false);
const refreshed = await call(path + "/preview", "POST", {
  priceCalculationId: ps.id,
});
assert.deepEqual(refreshed.blockers, []);
await call(path, "POST", confirm(refreshed, ps.id));
w = await call(path);
assert.equal(w.history.length, 2);
assert.equal(w.history[0].stale, false);
assert.equal(w.history[1].stale, true);
pass(
  "Changed upstream inputs invalidate selected prices and old confirmation; re-reviewed prices create a new total while preserving old totals",
);
const tie = await make("同分待处理汇总验收");
await submit(tie, editor, ["8", "8"], ["100", "0"]);
await submit(tie, viewer, ["6", "6"], ["0", "100"]);
await final(tie, ["100.00", "100.00"]);
const tp = await price(tie);
let tr = await call(tie.root + "/totals/rule", "PUT", save(cfg()));
await call(tie.root + "/totals/rule/freeze", "POST", freeze(tr));
const tied = await call(tie.root + "/totals/preview", "POST", {
  priceCalculationId: tp.id,
});
assert.deepEqual(
  tied.trace.subjects.map((x) => x.total),
  ["79.00", "79.00"],
);
assert.equal(tied.trace.ties.length, 1);
assert.deepEqual(tied.trace.ties[0].participationIds, [a, b]);
assert.deepEqual(
  tied.trace.subjects.map((x) => x.participationId),
  [a, b],
);
for (const key of ["rank", "winner", "recommended"])
  assert.ok(!JSON.stringify(tied.trace).includes('"' + key + '"'));
await call(tie.root + "/totals", "POST", confirm(tied, tp.id));
pass(
  "Equal final totals remain in source order and explicitly pending manual tie handling, with no rank or winner generated",
);
const browser = await make("综合评分汇总浏览器验收");
await submit(browser, editor, ["8", "8"], ["100", "0"]);
await submit(browser, viewer, ["6", "4"], ["0", "100"]);
await final(browser, ["100.00", "300.00"]);
const browserPrice = await price(browser);
await fs.writeFile(
  ".p0/p3-total-browser-session.json",
  JSON.stringify({ ...s, ...browser, priceCalculationId: browserPrice.id }),
  { mode: 0o600 },
);
await fs.writeFile(
  ".p0/p3-total-smoke-result.json",
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      scope:
        "isolated synthetic comprehensive consultation; exact equal-member totals with one objective price component; no ranking, recommendation or award",
    },
    null,
    2,
  ),
);
console.log("Controlled total HTTP passed:", checks.length, "checks");
