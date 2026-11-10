import { prepareSupplierDiscussions } from "./agency-discussion-support.mjs";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { uploadReceiptVersion } from "./agency-material-opening-support.mjs";
const s = JSON.parse(await fs.readFile(".p0/p3-total-browser-session.json")),
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
const bad = (p, m, b, status = 400, token = s.token, match = "") =>
  assert.rejects(
    () => call(p, m, b, token),
    new RegExp("failed: " + status + (match ? ".*" + match : "")),
  );
const root = (r) => "/evaluation/packages/" + pkg + "/rounds/" + r,
  roundRoot = root(s.roundId),
  main = "/evaluation/packages/" + pkg + "/sessions/" + s.sessionId;
const before = await call("/packages/" + pkg),
  rounds = await call("/evaluation/packages/" + pkg + "/rounds"),
  template = rounds.rounds.find((r) => r.round.id === s.roundId);
assert.ok(template);
const proof = s.proofId,
  secret = "CONFIDENTIAL-INCIDENT-TECHNICAL-ONLY";
const create = (effect = "pause", patch = {}) => ({
  kind: "network_failure",
  title: secret,
  occurredAt: new Date(Date.now() - 60000).toISOString(),
  responsibleId: s.userId,
  impactScope: "合成评审轮次及价格复核环节",
  description: "合成异常事实，不代表实际采购问题；" + secret,
  evidenceVersionId: proof,
  effect,
  restorationConditions: "人工核对故障排除及当前冻结基线；不放宽原守卫",
  reviewed: true,
  idempotencyKey: crypto.randomUUID(),
  ...patch,
});
const resolve = (i, outcome = "continue_ready") => ({
  expectedVersion: i.version,
  handledAt: new Date().toISOString(),
  outcome,
  evidenceVersionId: proof,
  conditionsChecked: true,
  note: "合成实际处理及条件核对，不替代更正授权或结果确认",
  idempotencyKey: crypto.randomUUID(),
});
const command = (w) => ({
  expectedVersion: w.control.version,
  casesFingerprint: w.casesFingerprint,
  evidenceVersionId: proof,
  reviewed: true,
  reason: "合成有权控制决定及恢复条件已核对，不放宽方式或人数条件",
  idempotencyKey: crypto.randomUUID(),
});
const totalRule = {
  method: "mean_raw_then_weight",
  totalScale: 2,
  totalRounding: "HALF_UP",
  tieHandling: "manual_pending",
  sources: [
    { criterionKey: "T1", source: "member_mean" },
    { criterionKey: "P1", source: "objective_price" },
  ],
};
let tr = await call(main + "/totals/rule", "PUT", {
  expectedVersion: 0,
  config: {
    ruleVersion: "INCIDENT-TOTAL-V1",
    basis: "合成汇总用于暂停恢复回归",
    locator: "合成汇总章节",
    documentRule: totalRule,
    configuredRule: totalRule,
  },
  reason: "合成汇总原文核对",
  idempotencyKey: crypto.randomUUID(),
});
await call(main + "/totals/rule/freeze", "POST", {
  expectedVersion: tr.version,
  reviewed: true,
  reason: "核对来源及全部成员",
  idempotencyKey: crypto.randomUUID(),
});
const priceScope = {
  participationIds: s.suppliers.map((x) => x.id),
  exclusions: {},
};
async function priceAndTotal() {
  const pp = await call(
    main + "/price-calculations/preview",
    "POST",
    priceScope,
  );
  assert.deepEqual(pp.blockers, []);
  const price = await call(main + "/price-calculations", "POST", {
    scope: priceScope,
    fingerprint: pp.fingerprint,
    evidenceVersionId: proof,
    reviewed: true,
    reason: "合成恢复后的价格复核",
    idempotencyKey: crypto.randomUUID(),
  });
  const tp = await call(main + "/totals/preview", "POST", {
    priceCalculationId: price.id,
  });
  assert.deepEqual(tp.blockers, []);
  const total = await call(main + "/totals", "POST", {
    priceCalculationId: price.id,
    fingerprint: tp.fingerprint,
    evidenceVersionId: proof,
    reviewed: true,
    reason: "合成恢复后的独立汇总复核，不作推荐",
    idempotencyKey: crypto.randomUUID(),
  });
  return { price, total, tp };
}
let prepared = await priceAndTotal();
const oldTrace = prepared.total.traceJson;
let w = await call(roundRoot + "/incidents");
assert.equal(w.control.state, "active");
assert.equal(w.control.version, 0);
await bad(roundRoot + "/incidents", "GET", undefined, 403, editor.token);
await bad(
  "/evaluation/packages/foreign/rounds/" + s.roundId + "/incidents",
  "GET",
  undefined,
  403,
);
await bad(
  roundRoot + "/incidents",
  "POST",
  create("observe", { reviewed: false }),
);
await bad(
  roundRoot + "/incidents",
  "POST",
  create("observe", { responsibleId: "foreign" }),
);
await bad(
  roundRoot + "/incidents",
  "POST",
  create("observe", {
    occurredAt: new Date(Date.now() + 3600000).toISOString(),
  }),
);
pass(
  "Default rounds remain active; frozen organizer/project scope, responsible accounts, occurrence time and explicit review are enforced",
);
const observing = create("observe");
let note = await call(roundRoot + "/incidents", "POST", observing);
assert.equal(
  (await call(roundRoot + "/incidents", "POST", observing)).id,
  note.id,
);
await bad(
  roundRoot + "/incidents",
  "POST",
  { ...observing, title: "changed" },
  409,
);
assert.equal((await call(roundRoot + "/control")).state, "active");
const reviewerStatus = await call(
  roundRoot + "/control",
  "GET",
  undefined,
  editor.token,
);
assert.ok(!JSON.stringify(reviewerStatus).includes(secret));
assert.ok(
  !JSON.stringify(await call("/execution/packages/" + pkg)).includes(secret),
);
const blockedPreview = await call(
  main + "/price-calculations/preview",
  "POST",
  priceScope,
);
assert.equal(blockedPreview.trace, null);
assert.ok(blockedPreview.blockers.some((x) => x.includes("未处理异常")));
pass(
  "Observe-only incidents retain normal control state yet block price results, and reviewer/general events receive no private incident details",
);
await bad(roundRoot + "/incidents/" + note.id + "/resolve", "POST", {
  ...resolve(note),
  conditionsChecked: false,
});
await bad(roundRoot + "/incidents/" + note.id + "/resolve", "POST", {
  ...resolve(note),
  handledAt: new Date(Date.now() - 86400000).toISOString(),
});
const rn = resolve(note);
await call(roundRoot + "/incidents/" + note.id + "/resolve", "POST", rn);
assert.equal(
  (await call(roundRoot + "/incidents/" + note.id + "/resolve", "POST", rn))
    .status,
  "resolved",
);
assert.equal((await call(roundRoot + "/control")).state, "active");
assert.equal(
  (await call(main + "/price-calculations")).history.find(
    (h) => h.calculation.id === prepared.price.id,
  ).stale,
  true,
);
assert.equal(
  (await call(main + "/totals")).history.find(
    (h) => h.snapshot.id === prepared.total.id,
  ).snapshot.traceJson,
  oldTrace,
);
pass(
  "Resolution chronology and conditions are required; observe resolution preserves history while its epoch invalidates pre-incident results",
);
prepared = await priceAndTotal();
const pausing = create("pause", { title: "暂停价格与汇总验证" });
let incident = await call(roundRoot + "/incidents", "POST", pausing);
w = await call(roundRoot + "/incidents");
assert.equal(w.control.state, "paused");
await bad(
  main + "/quotes",
  "POST",
  {
    participationId: s.suppliers[0].id,
    kind: "original",
    amount: "1",
    currency: "CNY",
    evidenceVersionId: proof,
    reason: "不得绕过暂停",
    reviewed: true,
    idempotencyKey: crypto.randomUUID(),
  },
  400,
  s.token,
  "暂停",
);
await bad(
  main + "/price-calculations",
  "POST",
  {
    scope: priceScope,
    fingerprint: "old",
    evidenceVersionId: proof,
    reviewed: true,
    reason: "不得绕过暂停",
    idempotencyKey: crypto.randomUUID(),
  },
  400,
  s.token,
  "暂停",
);
await bad(
  main + "/totals",
  "POST",
  {
    priceCalculationId: prepared.price.id,
    fingerprint: prepared.tp.fingerprint,
    evidenceVersionId: proof,
    reviewed: true,
    reason: "不得绕过暂停",
    idempotencyKey: crypto.randomUUID(),
  },
  400,
  s.token,
  "暂停",
);
await bad(main + "/final-quotes/receipts", "POST", {}, 400, s.token, "暂停");
await bad(
  main + "/stages/evaluation/release",
  "POST",
  {},
  400,
  s.token,
  "暂停",
);
await bad(roundRoot + "/materials/plan", "PUT", {}, 400, s.token, "暂停");
assert.equal(
  (await call(main + "/totals")).history.find(
    (h) => h.snapshot.id === prepared.total.id,
  ).snapshot.traceJson,
  prepared.total.traceJson,
);
await bad(roundRoot + "/control/resume", "POST", command(w));
await bad(
  roundRoot + "/control/resume",
  "POST",
  { ...command(w), expectedVersion: 999 },
  409,
);
pass(
  "A paused round blocks quotation, opening, phase, final quote, price and total writes while leaving exact prior snapshots readable",
);
const ready = resolve(incident);
await call(roundRoot + "/incidents/" + incident.id + "/resolve", "POST", ready);
w = await call(roundRoot + "/incidents");
assert.equal(w.control.state, "paused");
await bad(
  roundRoot + "/control/resume",
  "POST",
  { ...command(w), casesFingerprint: "stale" },
  409,
);
await bad(roundRoot + "/control/resume", "POST", {
  ...command(w),
  reviewed: false,
});
const resume = command(w);
await call(roundRoot + "/control/resume", "POST", resume);
assert.equal(
  (await call(roundRoot + "/control/resume", "POST", resume)).state,
  "active",
);
assert.equal(
  (await call(main + "/price-calculations")).history.find(
    (h) => h.calculation.id === prepared.price.id,
  ).stale,
  true,
);
await bad(
  main + "/totals",
  "POST",
  {
    priceCalculationId: prepared.price.id,
    fingerprint: prepared.tp.fingerprint,
    evidenceVersionId: proof,
    reviewed: true,
    reason: "旧确认不可恢复",
    idempotencyKey: crypto.randomUUID(),
  },
  409,
);
const renewed = await priceAndTotal();
assert.deepEqual(
  JSON.parse(renewed.total.traceJson).subjects.map((x) => x.total),
  ["79.00", "52.00"],
);
pass(
  "Closing the last case never auto-resumes; separately reviewed resume checks all versions and requires fresh price/total review afterward",
);
async function frozen(title) {
  let r = await call("/evaluation/packages/" + pkg + "/rounds", "POST", {
    expectedVersion: 0,
    config: { ...template.config, title: title + " " + Date.now() },
    reason: "异常技术验证独立轮次",
    idempotencyKey: crypto.randomUUID(),
  });
  r = await call(
    "/evaluation/packages/" + pkg + "/rounds/" + r.round.id + "/freeze",
    "POST",
    {
      expectedVersion: r.round.version,
      businessRulesReviewed: true,
      reason: "核对合成规则",
      idempotencyKey: crypto.randomUUID(),
    },
  );
  return r;
}
const fresh = await frozen("暂停材料及个人草稿验收"),
  fr = root(fresh.round.id),
  now = Date.now(),
  participant = s.suppliers[0].id;
const config = {
  cutoffAt: new Date(now - 120000).toISOString(),
  notBefore: new Date(now - 60000).toISOString(),
  minimumSubjects: 1,
  ruleBasis: "合成清单门槛，不作实际规则",
  items: [
    {
      key: "response",
      title: "响应副本",
      required: true,
      readerRoles: ["organizer", "review_member"],
    },
  ],
};
let plan = await call(fr + "/materials/plan", "PUT", {
  expectedVersion: 0,
  config,
  reason: "合成接收计划",
  idempotencyKey: crypto.randomUUID(),
});
plan = await call(fr + "/materials/plan/confirm", "POST", {
  expectedVersion: plan.version,
  reviewed: true,
  reason: "核对清单和时间",
  idempotencyKey: crypto.randomUUID(),
});
const receipt = await call(fr + "/materials/receipts", "POST", {
  participationId: participant,
  itemKey: "response",
  fileName: "暂停材料合成.txt",
  receivedAt: new Date(now - 300000).toISOString(),
  originalType: "electronic_copy",
  sourceNote: "合成受控副本",
  note: "技术验证",
  lateEntryReason: "核对时点后补录",
  idempotencyKey: crypto.randomUUID(),
});
async function issuedTicket(version) {
  const r = await fetch(base + "/api/v1/buyer/attachments/upload-ticket", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      ownerType: "agency_file_version",
      ownerId: version,
      fileName: "暂停材料合成.txt",
      visibility: "buyer_internal",
    }),
  });
  assert.equal(r.status, 200);
  return (await r.json()).data;
}
async function issuedUploadBlocked(ticket, version) {
  const r = await fetch(base + ticket.uploadUrl, {
    method: "POST",
    headers: { ...headers(), "content-type": "application/octet-stream" },
    body: Buffer.from("合成票据暂停后不得继续上传"),
  });
  assert.equal(r.status, 400);
  assert.match((await r.json()).message, /暂停/);
  const registration = await fetch(base + "/api/v1/buyer/attachments", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      ownerType: "agency_file_version",
      ownerId: version,
      fileName: "暂停材料合成.txt",
      visibility: "buyer_internal",
      storageKey: ticket.storageKey,
    }),
  });
  assert.equal(registration.status, 400);
  assert.match((await registration.json()).message, /暂停/);
}
const responseTicket = await issuedTicket(receipt.file.versions[0].id);
let case1 = await call(fr + "/incidents", "POST", create());
const ticket = (v) => ({
  ownerType: "agency_file_version",
  ownerId: v,
  fileName: "暂停材料合成.txt",
  visibility: "buyer_internal",
});
async function rawTicketBlocked(version) {
  const r = await fetch(base + "/api/v1/buyer/attachments/upload-ticket", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(ticket(version)),
  });
  assert.equal(r.status, 400);
  assert.match((await r.json()).message, /暂停/);
}
await rawTicketBlocked(receipt.file.versions[0].id);
await issuedUploadBlocked(responseTicket, receipt.file.versions[0].id);
await bad(fr + "/materials/open", "POST", {}, 400, s.token, "暂停");
await bad(
  "/evaluation/packages/" + pkg + "/rounds/" + fresh.round.id + "/assessment",
  "POST",
  {},
  400,
  s.token,
  "暂停",
);
await call(fr + "/incidents/" + case1.id + "/resolve", "POST", resolve(case1));
w = await call(fr + "/incidents");
await rawTicketBlocked(receipt.file.versions[0].id);
await call(fr + "/control/resume", "POST", command(w));
await uploadReceiptVersion(
  receipt.file.versions[0].id,
  "暂停材料合成.txt",
  "合成响应副本：暂停前不上传，恢复后封存。",
  headers,
);
const preview = await call(fr + "/materials/preview", "POST", {
  participationIds: [participant],
});
assert.deepEqual(preview.blockers, []);
const opened = await call(fr + "/materials/open", "POST", {
  expectedVersion: plan.version,
  participationIds: [participant],
  previewFingerprint: preview.fingerprint,
  openedAt: new Date().toISOString(),
  evidenceVersionId: proof,
  reviewed: true,
  note: "恢复后核对正式开启",
  idempotencyKey: crypto.randomUUID(),
});
const session = await call(fr + "/assessment", "POST", {
  expectedRoundVersion: fresh.round.version,
  participationIds: [participant],
  openingEvidenceVersionId: proof,
  openedAt: opened.openedAt,
  openingReviewed: true,
  note: "恢复后建立独立任务",
  idempotencyKey: crypto.randomUUID(),
});
pass(
  "Before a session exists, pause also blocks raw response upload tickets, formal opening and assessment creation; resolution alone keeps uploads closed",
);
const sr = "/evaluation/packages/" + pkg + "/sessions/" + session.id,
  mp = sr + "/mine?stage=evaluation";
let mine = await call(mp, "GET", undefined, editor.token);
const entries = ["T1", "P1"].map((key) => ({
  participationId: participant,
  criterionKey: key,
  score: key === "T1" ? "8" : "100",
  conclusion: null,
  evidence: "合成材料",
  opinion: "本人草稿应完整保留",
}));
await call(
  mp,
  "PUT",
  {
    expectedVersion: mine.sheets[0].version,
    entries,
    idempotencyKey: crypto.randomUUID(),
  },
  editor.token,
);
mine = await call(mp, "GET", undefined, editor.token);
const old = mine.sheets[0];
const discussionFingerprint = await prepareSupplierDiscussions({
  call,
  root: sr,
  proofId: proof,
  participantIds: [participant],
});
const initiatedAt = new Date().toISOString();
await call(sr + "/final-quotes", "POST", {
  discussionFingerprint,
  participationIds: [participant],
  exclusions: {},
  initiatedAt,
  cutoffAt: new Date(Date.now() + 3600000).toISOString(),
  requirementsVersionId: proof,
  noticeVersionId: proof,
  reviewed: true,
  reason: "合成最后报价接收守卫验证",
  idempotencyKey: crypto.randomUUID(),
});
const finalReceipt = await call(sr + "/final-quotes/receipts", "POST", {
  participationId: participant,
  fileName: "暂停最后报价合成.txt",
  amount: "100",
  currency: "CNY",
  receivedAt: new Date().toISOString(),
  originalType: "electronic_copy",
  sourceNote: "合成最终响应",
  lateEntryReason: "",
  idempotencyKey: crypto.randomUUID(),
});
const finalTicket = await issuedTicket(finalReceipt.file.versions[0].id);
let case2 = await call(
  fr + "/incidents",
  "POST",
  create("pause", { title: "个人草稿及最后报价暂停验证" }),
);
mine = await call(mp, "GET", undefined, editor.token);
assert.equal(mine.writable, false);
assert.equal(mine.sheets[0].entriesJson, old.entriesJson);
await bad(
  mp,
  "PUT",
  {
    expectedVersion: old.version,
    entries,
    idempotencyKey: crypto.randomUUID(),
  },
  400,
  editor.token,
  "暂停",
);
await bad(
  sr + "/mine/submit?stage=evaluation",
  "POST",
  {
    expectedVersion: old.version,
    personallyConfirmed: true,
    idempotencyKey: crypto.randomUUID(),
  },
  400,
  editor.token,
  "暂停",
);
await rawTicketBlocked(finalReceipt.file.versions[0].id);
await issuedUploadBlocked(finalTicket, finalReceipt.file.versions[0].id);
await call(fr + "/incidents/" + case2.id + "/resolve", "POST", resolve(case2));
w = await call(fr + "/incidents");
await call(fr + "/control/resume", "POST", command(w));
await uploadReceiptVersion(
  finalReceipt.file.versions[0].id,
  "暂停材料合成.txt",
  "合成最后报价材料：恢复后才允许封存。",
  headers,
);
mine = await call(mp, "GET", undefined, editor.token);
assert.equal(mine.writable, true);
assert.equal(mine.sheets[0].entriesJson, old.entriesJson);
pass(
  "Personal drafts survive pauses byte-for-byte; independent saves/submits and raw final-response uploads are closed until separately restored",
);
const fatal = await frozen("另行组织和停止验收"),
  fatalRoot = root(fatal.round.id);
let fatalCase = await call(
  fatalRoot + "/incidents",
  "POST",
  create("pause", { kind: "reorganization" }),
);
await call(
  fatalRoot + "/incidents/" + fatalCase.id + "/resolve",
  "POST",
  resolve(fatalCase, "reorganize"),
);
w = await call(fatalRoot + "/incidents");
await bad(fatalRoot + "/control/resume", "POST", command(w));
await call(fatalRoot + "/control/terminate", "POST", command(w));
w = await call(fatalRoot + "/incidents");
assert.equal(w.control.state, "terminated");
assert.equal(w.incidents.length, 1);
await bad(fatalRoot + "/control/resume", "POST", command(w));
await bad(fatalRoot + "/incidents", "POST", create("observe"));
assert.equal((await call(fr + "/control")).state, "active");
pass(
  "Reorganization decisions cannot restore the old round; explicit termination is sticky and isolated from other rounds",
);
const invalid = await frozen("失效冻结基线阻断恢复"),
  invalidRoot = root(invalid.round.id);
let invalidCase = await call(invalidRoot + "/incidents", "POST", create());
await call(
  invalidRoot + "/incidents/" + invalidCase.id + "/resolve",
  "POST",
  resolve(invalidCase),
);
await call(invalidRoot + "/void", "POST", {
  expectedVersion: invalid.round.version,
  businessRulesReviewed: true,
  reason: "合成作废：旧基线不得用恢复按钮激活",
  idempotencyKey: crypto.randomUUID(),
});
w = await call(invalidRoot + "/incidents");
await bad(
  invalidRoot + "/control/resume",
  "POST",
  command(w),
  400,
  s.token,
  "基线",
);
const after = await call("/packages/" + pkg);
for (const key of [
  "businessStatus",
  "archiveCompletion",
  "financialStatus",
  "procurementMethod",
])
  assert.equal(after.record[key], before.record[key]);
pass(
  "A voided baseline cannot be revived by resolving cases or using resume, and procurement mode plus three package statuses stay unchanged",
);
const browser = await frozen("评审异常控制浏览器验收");
await fs.writeFile(
  ".p0/p3-incident-browser-session.json",
  JSON.stringify({ ...s, roundId: browser.round.id }),
  { mode: 0o600 },
);
await fs.writeFile(
  ".p0/p3-incident-smoke-result.json",
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      scope:
        "isolated synthetic round incidents and controls; desensitized evidence only; no member replacement, legal adjudication, automatic procurement termination or production deployment",
    },
    null,
    2,
  ),
);
console.log("Incident/control HTTP passed:", checks.length, "checks");
