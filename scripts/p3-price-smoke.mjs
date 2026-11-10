import { prepareFinalResponseReview } from "./agency-final-response-support.mjs";
import { prepareSupplierDiscussions } from "./agency-discussion-support.mjs";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {
  prepareMaterialOpening,
  uploadReceiptVersion,
} from "./agency-material-opening-support.mjs";
const s = JSON.parse(
    await fs.readFile(".p0/p3-final-quote-browser-session.json"),
  ),
  editor = JSON.parse(await fs.readFile(".p0/p3-opening-editor-session.json"));
assert.ok(s.tenantId.startsWith("agency-assessment-"));
const base = "http://127.0.0.1:18080",
  checks = [],
  pass = (t) => {
    checks.push(t);
    console.log("PASS", t);
  },
  headers = () => ({
    authorization: "Bearer " + s.token,
    "content-type": "application/json",
  }),
  pkg = s.packageId;
async function call(path, method = "GET", body, token = s.token) {
  const r = await fetch(base + "/api/v1/buyer/agency" + path, {
    method,
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const out = await r.json();
  if (r.status !== 200) throw Error("failed: " + r.status + " " + out.message);
  return out.data;
}
const bad = (p, m, b, status = 400, token = s.token) =>
  assert.rejects(() => call(p, m, b, token), new RegExp("failed: " + status));
for (let i = 0; i < 120; i++) {
  try {
    if ((await fetch(base + "/actuator/health")).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
async function refreshSynthetic(user) {
  const r = await fetch(base + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      account: user.userId + "@example.com",
      password: "demo123456",
      scope: "BUYER",
      tenantId: user.tenantId,
    }),
  });
  assert.equal(r.status, 200, "Synthetic fixture login failed");
  const j = await r.json();
  user.token = (j.data || j).accessToken;
  assert.equal(typeof user.token, "string");
}
await refreshSynthetic(s);
await refreshSynthetic(editor);
for (const name of await fs.readdir(".p0"))
  if (name.includes("session") && name.endsWith(".json")) {
    try {
      const file = ".p0/" + name;
      const stored = JSON.parse(await fs.readFile(file));
      const user = [s, editor].find(
        (u) => u.userId === stored.userId && u.tenantId === stored.tenantId,
      );
      if (user && stored.token) {
        stored.token = user.token;
        await fs.writeFile(file, JSON.stringify(stored), { mode: 0o600 });
      }
    } catch {}
  }
assert.equal(
  (await call("/packages/" + pkg)).record.procurementMethod,
  "竞争性磋商",
);
const rounds = await call("/evaluation/packages/" + pkg + "/rounds"),
  source = rounds.rounds.find((r) => r.round.id === s.roundId);
assert.ok(source);
const [a, b] = s.suppliers.map((v) => v.id),
  scope = { participationIds: [a, b], exclusions: {} };
const rule = (patch = {}) => ({
  priceSource: "final_original",
  formula: "minimum_ratio",
  criterionKey: "P1",
  fullScore: "30",
  scale: 2,
  rounding: "HALF_UP",
  tieRule: "按合成定稿另行核对同价同分，不自动排序",
  ...patch,
});
const config = (document = rule(), configured = rule()) => ({
  ruleVersion: "TECH-PRICE-V1",
  basis: "合成价格规则技术验证，非实际采购适用认定",
  locator: "合成定稿价格项P1及价格计算说明",
  documentRule: document,
  configuredRule: configured,
});
const save = (c, v = 0) => ({
  expectedVersion: v,
  config: c,
  reason: "合成价格规则原文核对",
  idempotencyKey: crypto.randomUUID(),
});
const freeze = (r) => ({
  expectedVersion: r.version,
  reviewed: true,
  reason: "逐项核对价格来源、价格项权重和最终除法舍入",
  idempotencyKey: crypto.randomUUID(),
});
async function make(title, minimumSubjects = 1) {
  const technical = {
      ...source.config.rules[0].configuredRule,
      key: "T1",
      stage: "technical",
      weight: "70",
    },
    price = {
      ...technical,
      key: "P1",
      title: "独立价格分技术项",
      stage: "commercial",
      minimum: "0",
      maximum: "100",
      weight: "30",
    };
  const cfg = {
    ...source.config,
    title: title + " " + Date.now(),
    members: [
      { userId: s.userId, roles: ["organizer"] },
      { userId: editor.userId, roles: ["review_member"] },
    ],
    rules: [technical, price].map((r) => ({
      documentRule: r,
      configuredRule: r,
      locator: "合成规则章节，不作实际采购依据",
      manuallyChecked: true,
    })),
  };
  let round = await call("/evaluation/packages/" + pkg + "/rounds", "POST", {
    expectedVersion: 0,
    config: cfg,
    reason: "价格技术检查独立轮次",
    idempotencyKey: crypto.randomUUID(),
  });
  round = await call(
    "/evaluation/packages/" + pkg + "/rounds/" + round.round.id + "/freeze",
    "POST",
    {
      expectedVersion: round.round.version,
      businessRulesReviewed: true,
      reason: "人工核对合成70/30规则",
      idempotencyKey: crypto.randomUUID(),
    },
  );
  const opened = await prepareMaterialOpening({
    call,
    headers,
    pkg,
    round: round.round.id,
    participantIds: [a, b],
    proofId: s.proofId,
    clock: Date.now() - 7200000,
    minimumSubjects,
  });
  const session = await call(
    "/evaluation/packages/" + pkg + "/rounds/" + round.round.id + "/assessment",
    "POST",
    {
      expectedRoundVersion: round.round.version,
      participationIds: [a, b],
      openingEvidenceVersionId: s.proofId,
      openedAt: opened.opening.openedAt,
      openingReviewed: true,
      note: "合成价格计算技术验收",
      idempotencyKey: crypto.randomUUID(),
    },
  );
  return {
    roundId: round.round.id,
    sessionId: session.id,
    root: "/evaluation/packages/" + pkg + "/sessions/" + session.id,
  };
}
async function submitOpinions(f) {
  const p = f.root + "/mine?stage=evaluation";
  let mine = await call(p, "GET", undefined, editor.token);
  const rows = s.suppliers.flatMap((v) =>
    ["T1", "P1"].map((key) => ({
      participationId: v.id,
      criterionKey: key,
      score: key === "T1" ? "8" : "100",
      conclusion: null,
      evidence: "合成材料页码",
      opinion: "PRIVATE-PRICE-REVIEW-DO-NOT-EXPOSE",
    })),
  );
  await call(
    p,
    "PUT",
    {
      expectedVersion: mine.sheets[0].version,
      entries: rows,
      idempotencyKey: crypto.randomUUID(),
    },
    editor.token,
  );
  mine = await call(p, "GET", undefined, editor.token);
  await call(
    f.root + "/mine/submit?stage=evaluation",
    "POST",
    {
      expectedVersion: mine.sheets[0].version,
      personallyConfirmed: true,
      idempotencyKey: crypto.randomUUID(),
    },
    editor.token,
  );
}
async function finalQuotes(f, values = ["100.00", "300.00"]) {
  const discussionFingerprint = await prepareSupplierDiscussions({
    call,
    root: f.root,
    proofId: s.proofId,
    participantIds: [a, b],
  });
  const root = f.root + "/final-quotes",
    now = Date.now();
  await call(root, "POST", {
    discussionFingerprint,
    participationIds: [a, b],
    exclusions: {},
    initiatedAt: new Date(now - 3600000).toISOString(),
    cutoffAt: new Date(now - 60000).toISOString(),
    requirementsVersionId: s.proofId,
    noticeVersionId: s.proofId,
    reviewed: true,
    reason: "合成最终需求、最终响应及发起通知核对",
    idempotencyKey: crypto.randomUUID(),
  });
  const decisions = [];
  for (const [i, id] of [a, b].entries()) {
    if (values[i] === null) {
      decisions.push({
        participationId: id,
        receiptId: null,
        status: "not_submitted",
        reason: "未提交最后报价，不复制初次报价；另按规则处理",
      });
      continue;
    }
    const row = await call(root + "/receipts", "POST", {
      participationId: id,
      fileName: "价格计算最终响应合成.txt",
      amount: values[i],
      currency: "CNY",
      receivedAt: new Date(now - 120000).toISOString(),
      originalType: "electronic_copy",
      sourceNote: "合成最终响应及报价副本，导入人员不代表供应商身份",
      lateEntryReason: "合成接收时点核对后补录",
      idempotencyKey: crypto.randomUUID(),
    });
    await uploadReceiptVersion(
      row.file.versions[0].id,
      "价格计算最终响应合成.txt",
      "合成最终响应及价格 " + values[i],
      headers,
    );
    decisions.push({
      participationId: id,
      receiptId: row.receipt.id,
      status: "accepted",
      reason: "合成按时最终响应及报价已核对",
    });
  }
  const w = await call(root);
  await call(root + "/confirm", "POST", {
    expectedVersion: w.campaign.version,
    receiptFingerprint: w.receiptFingerprint,
    decisions,
    evidenceVersionId: s.proofId,
    reviewed: true,
    note: "合成最终报价逐家核对，不自动恢复或成交",
    idempotencyKey: crypto.randomUUID(),
  });
  await prepareFinalResponseReview({
    call,
    root: f.root,
    proofId: s.proofId,
    tokens: { [s.userId]: s.token, [editor.userId]: editor.token },
  });
}
async function initial(
  f,
  id = a,
  amount = "500.00",
  kind = "original",
  previous = null,
) {
  return call(f.root + "/quotes", "POST", {
    participationId: id,
    expectedPreviousId: previous,
    kind,
    amount,
    currency: "CNY",
    evidenceVersionId: s.proofId,
    reason: "合成初次报价，不替代最终报价",
    reviewed: true,
    idempotencyKey: crypto.randomUUID(),
  });
}
const confirm = (p, scopeOverride = scope) => ({
  scope: scopeOverride,
  fingerprint: p.fingerprint,
  evidenceVersionId: s.proofId,
  reviewed: true,
  reason: "人工复核合成范围、排除依据和所有价格计算明细",
  idempotencyKey: crypto.randomUUID(),
});
const f = await make("价格计算接口技术验收"),
  path = f.root + "/price-calculations";
await bad(path, "GET", undefined, 403, editor.token);
await bad(
  "/evaluation/packages/foreign-package/sessions/" +
    f.sessionId +
    "/price-calculations",
  "GET",
  undefined,
  403,
);
assert.equal((await call(path)).rule, null);
let p = await call(path + "/preview", "POST", scope);
assert.ok(p.blockers.includes("价格规则尚未冻结"));
pass(
  "Project scope and frozen organizer duties protect rules and calculations; no rule produces no price result",
);
let row = await call(
  path + "/rule",
  "PUT",
  save(config(rule(), rule({ scale: 3 }))),
);
assert.deepEqual((await call(path)).differences, ["保留位数"]);
await bad(path + "/rule/freeze", "POST", freeze(row));
await bad(path + "/rule", "PUT", save(config(), 999), 409);
await bad(
  path + "/rule",
  "PUT",
  save(config(rule({ formula: "eval(1)" }), rule()), row.version),
);
pass(
  "Independent original/configured rules expose mismatches and reject unsupported formulas and stale edits",
);
row = await call(
  path + "/rule",
  "PUT",
  save(
    config(
      rule({ priceSource: "original" }),
      rule({ priceSource: "original" }),
    ),
    row.version,
  ),
);
await bad(path + "/rule/freeze", "POST", freeze(row));
row = await call(
  path + "/rule",
  "PUT",
  save(
    config(rule({ fullScore: "31" }), rule({ fullScore: "31" })),
    row.version,
  ),
);
await bad(path + "/rule/freeze", "POST", freeze(row));
row = await call(path + "/rule", "PUT", save(config(), row.version));
await bad(path + "/rule/freeze", "POST", { ...freeze(row), reviewed: false });
const fb = freeze(row);
row = await call(path + "/rule/freeze", "POST", fb);
assert.equal(
  (await call(path + "/rule/freeze", "POST", fb)).frozenHash,
  row.frozenHash,
);
await bad(path + "/rule", "PUT", save(config(), row.version));
pass(
  "Final-price-only source, frozen price weight and explicit review gate an immutable, idempotent rule snapshot",
);
const first = await initial(f);
await initial(f, b);
p = await call(path + "/preview", "POST", scope);
assert.ok(p.blockers.some((x) => x.includes("独立意见尚未全部提交")));
assert.equal(p.trace, null);
await submitOpinions(f);
p = await call(path + "/preview", "POST", scope);
assert.ok(p.blockers.some((x) => x.includes("缺少指定来源")));
assert.equal(p.trace, null);
pass(
  "Incomplete opinions and missing confirmed final quotes block computation even when initial prices exist",
);
await finalQuotes(f);
p = await call(path + "/preview", "POST", scope);
assert.deepEqual(p.blockers, []);
assert.equal(p.trace.minimum, "100.00");
assert.deepEqual(
  p.trace.lines.map((l) => l.score),
  ["30.00", "10.00"],
);
assert.equal(p.trace.lines[1].numerator, "3000.00");
assert.equal(p.trace.lines[1].sourceKind, "final_original");
assert.ok(!JSON.stringify(await call(path)).includes("PRIVATE-PRICE-REVIEW"));
pass(
  "Confirmed final prices yield exact 30.00/10.00 price points with traceable source versions and no private opinions",
);
await bad(path, "POST", { ...confirm(p), reviewed: false });
await bad(path, "POST", { ...confirm(p), fingerprint: "old" }, 409);
await bad(path, "POST", { ...confirm(p), evidenceVersionId: null });
const body = confirm(p),
  saved = await call(path, "POST", body);
assert.equal((await call(path, "POST", body)).id, saved.id);
let w = await call(path);
assert.equal(w.history.length, 1);
assert.equal(w.history[0].stale, false);
assert.equal(saved.ruleHash, row.frozenHash);
pass(
  "Human scope/trace review, sealed evidence and exact input fingerprint protect an immutable idempotent calculation snapshot",
);
await initial(f, a, "499.00", "correction", first.id);
w = await call(path);
assert.equal(w.history[0].stale, true);
assert.deepEqual(
  JSON.parse(w.history[0].calculation.traceJson).lines.map((l) => l.score),
  ["30.00", "10.00"],
);
await bad(
  path,
  "POST",
  { ...confirm(p), idempotencyKey: crypto.randomUUID() },
  409,
);
const newPreview = await call(path + "/preview", "POST", scope);
assert.notEqual(newPreview.fingerprint, p.fingerprint);
assert.deepEqual(
  newPreview.trace.lines.map((l) => l.score),
  ["30.00", "10.00"],
);
pass(
  "Later price-ledger revisions invalidate old confirmation and mark history stale without rewriting old arithmetic",
);
const missing = await make("价格缺失不回填验收"),
  mp = missing.root + "/price-calculations";
await submitOpinions(missing);
await finalQuotes(missing, ["100.00", null]);
await initial(missing, b, "1.00");
let mr = await call(mp + "/rule", "PUT", save(config()));
await call(mp + "/rule/freeze", "POST", freeze(mr));
const missingPreview = await call(mp + "/preview", "POST", scope);
assert.equal(missingPreview.trace, null);
assert.ok(missingPreview.blockers.some((x) => x.includes("缺少指定来源")));
await bad(mp + "/preview", "POST", { participationIds: [a], exclusions: {} });
const subset = {
  participationIds: [a],
  exclusions: {
    [b]: "未提交最后报价，依脱敏有权处理凭证不纳入本次独立价格计算；不自动恢复或推荐",
  },
};
const subsetPreview = await call(mp + "/preview", "POST", subset);
assert.deepEqual(subsetPreview.blockers, []);
await call(mp, "POST", confirm(subsetPreview, subset));
pass(
  "Missing final prices are never filled from cheap initial prices; excluding a subject requires explicit recorded handling",
);
const zero = await make("零价比例阻断验收", 2),
  zp = zero.root + "/price-calculations";
await submitOpinions(zero);
await finalQuotes(zero, ["0.00", "300.00"]);
let zr = await call(zp + "/rule", "PUT", save(config()));
await call(zp + "/rule/freeze", "POST", freeze(zr));
const zeroPreview = await call(zp + "/preview", "POST", scope);
assert.equal(zeroPreview.trace, null);
assert.ok(zeroPreview.blockers.some((x) => x.includes("零价格")));
await bad(zp, "POST", confirm(zeroPreview));
pass(
  "A zero-priced confirmed final response remains original data while the ratio formula safely blocks division by zero",
);
const insufficient = await call(zp + "/preview", "POST", {
  participationIds: [a],
  exclusions: { [b]: "合成排除依据不应自动放宽已锁定的两家门槛" },
});
assert.equal(insufficient.trace, null);
assert.ok(insufficient.blockers.some((x) => x.includes("数量不足")));
pass(
  "Explicit exclusion reasons cannot silently relax the frozen minimum subject count",
);
const browser = await make("价格规则计算浏览器验收");
await submitOpinions(browser);
await finalQuotes(browser);
await fs.writeFile(
  ".p0/p3-price-browser-session.json",
  JSON.stringify({ ...s, ...browser }),
  { mode: 0o600 },
);
await fs.writeFile(
  ".p0/p3-price-smoke-result.json",
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      scope:
        "isolated synthetic consultation price component only; no total score, ranking, recommendation or award",
    },
    null,
    2,
  ),
);
console.log("Price calculation HTTP passed:", checks.length, "checks");
