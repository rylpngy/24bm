import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { prepareMaterialOpening } from "./agency-material-opening-support.mjs";
import { prepareSupplierDiscussions } from "./agency-discussion-support.mjs";
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
const bad = (p, m, b, status = 400, token = s.token) =>
  assert.rejects(() => call(p, m, b, token), new RegExp("failed: " + status));
const [a, b] = s.suppliers.map((v) => v.id),
  proof = s.proofId;
const rounds = await call("/evaluation/packages/" + pkg + "/rounds"),
  template = rounds.rounds.find((v) => v.round.id === s.roundId);
assert.ok(template);
async function make(title) {
  let r = await call("/evaluation/packages/" + pkg + "/rounds", "POST", {
    expectedVersion: 0,
    config: { ...template.config, title: title + " " + Date.now() },
    reason: "逐家沟通合成技术验证，不作实际规则",
    idempotencyKey: crypto.randomUUID(),
  });
  r = await call(
    "/evaluation/packages/" + pkg + "/rounds/" + r.round.id + "/freeze",
    "POST",
    {
      expectedVersion: r.round.version,
      businessRulesReviewed: true,
      reason: "人工核对合成规则",
      idempotencyKey: crypto.randomUUID(),
    },
  );
  const opening = await prepareMaterialOpening({
    call,
    headers,
    pkg,
    round: r.round.id,
    participantIds: [a, b],
    proofId: proof,
    clock: Date.now() - 7200000,
  });
  const session = await call(
    "/evaluation/packages/" + pkg + "/rounds/" + r.round.id + "/assessment",
    "POST",
    {
      expectedRoundVersion: r.round.version,
      participationIds: [a, b],
      openingEvidenceVersionId: proof,
      openedAt: opening.opening.openedAt,
      openingReviewed: true,
      note: "合成逐家沟通技术验收",
      idempotencyKey: crypto.randomUUID(),
    },
  );
  return {
    sessionId: session.id,
    roundId: r.round.id,
    openedAt: session.openedAt,
    root: "/evaluation/packages/" + pkg + "/sessions/" + session.id,
  };
}
const activation = (version = 0) => ({
  expectedVersion: version,
  evidenceVersionId: proof,
  reviewed: true,
  reason: "已人工核对合成逐家对象范围与适用过程",
  idempotencyKey: crypto.randomUUID(),
});
const content = (f, index, id = a, change = "none") => ({
  startedAt: new Date(
    Date.parse(f.openedAt) + (10 + index * 10) * 60000,
  ).toISOString(),
  endedAt: new Date(
    Date.parse(f.openedAt) + (15 + index * 10) * 60000,
  ).toISOString(),
  staffUserIds: [s.userId, editor.userId],
  supplierAttendees: "合成线下代表；身份及授权来源仅为人工登记",
  agenda: "合成第" + (index + 1) + "次议题",
  discussion: "PRIVATE-DISCUSSION-" + id + "-" + index,
  supplierResponse: "PRIVATE-RESPONSE-" + id,
  conclusion: "本对象过程已核对，不代替审查结论",
  changeDisposition: change,
  changeNote:
    change === "none" ? "" : "待有权确认及向参与者同步通知，不作为批准",
  evidenceVersionId: proof,
});
const save = (c, row = null) => ({
  recordId: row?.id || null,
  expectedVersion: row?.version || 0,
  content: c,
  reason: "合成逐家沟通草稿维护",
  idempotencyKey: crypto.randomUUID(),
});
async function confirm(f, id, row, patch = {}) {
  const w = await call(f.root + "/discussions");
  const body = {
    expectedVersion: row.version,
    expectedPreviousId: row.previousId,
    expectedFingerprint: w.fingerprint,
    supplierConfirmationVersionId: proof,
    supplierConfirmationNote:
      "人工核对合成线下确认凭证，不代表在线供应商身份或电子签署",
    reviewed: true,
    idempotencyKey: crypto.randomUUID(),
    ...patch,
  };
  return {
    body,
    row: await call(
      f.root + "/discussions/" + id + "/" + row.id + "/confirm",
      "POST",
      body,
    ),
  };
}
const finalBody = (f, fp, ids = [a, b]) => ({
  participationIds: ids,
  exclusions: Object.fromEntries(
    [a, b]
      .filter((id) => !ids.includes(id))
      .map((id) => [id, "合成未进入最后报价的处理依据，不用于绕过需求变更"]),
  ),
  initiatedAt: new Date(Date.now() - 1800000).toISOString(),
  cutoffAt: new Date(Date.now() + 3600000).toISOString(),
  requirementsVersionId: proof,
  noticeVersionId: proof,
  discussionFingerprint: fp,
  reviewed: true,
  reason: "合成最终需求、已确认逐家记录及通知凭证核对",
  idempotencyKey: crypto.randomUUID(),
});
const f = await make("逐家沟通过程接口验收"),
  p = f.root + "/discussions";
let w = await call(p);
assert.equal(w.mode, "required");
await bad(p, "GET", undefined, 403, editor.token);
await bad(
  "/evaluation/packages/foreign/sessions/" + f.sessionId + "/discussions",
  "GET",
  undefined,
  403,
);
await bad(f.root + "/final-quotes", "POST", finalBody(f, null), 409);
await bad(p + "/activate", "POST", { ...activation(), reviewed: false });
await bad(p + "/activate", "POST", activation(999), 409);
const ab = activation();
await call(p + "/activate", "POST", ab);
assert.equal((await call(p + "/activate", "POST", ab)).mode, "active");
await bad(p + "/activate", "POST", activation(1));
pass(
  "New assessment sessions require explicit immutable process activation; project/frozen-organizer duties and activation review/version are enforced",
);
const partial = {
  startedAt: null,
  endedAt: null,
  staffUserIds: [],
  supplierAttendees: "",
  agenda: "",
  discussion: "PRIVATE-PARTIAL-A",
  supplierResponse: "",
  conclusion: "",
  changeDisposition: null,
  changeNote: "",
  evidenceVersionId: null,
};
let draftA = await call(p + "/" + a + "/draft", "PUT", save(partial));
w = await call(p);
await bad(p + "/" + a + "/" + draftA.id + "/confirm", "POST", {
  expectedVersion: draftA.version,
  expectedPreviousId: null,
  expectedFingerprint: w.fingerprint,
  supplierConfirmationVersionId: proof,
  supplierConfirmationNote: "合成未完成草稿",
  reviewed: true,
  idempotencyKey: crypto.randomUUID(),
});
assert.equal(
  (await call(p + "/" + a)).records[0].contentJson,
  draftA.contentJson,
);
await bad(p + "/" + a + "/draft", "PUT", save(content(f, 0)));
await bad(
  p + "/" + a + "/draft",
  "PUT",
  { ...save(content(f, 0), draftA), expectedVersion: 999 },
  409,
);
await bad(
  p + "/" + a + "/draft",
  "PUT",
  save({ ...content(f, 0), staffUserIds: ["foreign"] }, draftA),
);
draftA = await call(p + "/" + a + "/draft", "PUT", save(content(f, 0), draftA));
const oldFp = (await call(p)).fingerprint;
let draftB = await call(
  p + "/" + b + "/draft",
  "PUT",
  save({ ...partial, discussion: "PRIVATE-PARTIAL-B" }),
);
await bad(
  p + "/" + a + "/" + draftA.id + "/confirm",
  "POST",
  {
    expectedVersion: draftA.version,
    expectedPreviousId: null,
    expectedFingerprint: oldFp,
    supplierConfirmationVersionId: proof,
    supplierConfirmationNote: "旧过程指纹不能确认",
    reviewed: true,
    idempotencyKey: crypto.randomUUID(),
  },
  409,
);
await bad(p + "/" + b + "/" + draftA.id + "/confirm", "POST", {
  expectedVersion: draftA.version,
  expectedPreviousId: null,
  expectedFingerprint: (await call(p)).fingerprint,
  supplierConfirmationVersionId: proof,
  supplierConfirmationNote: "跨供应商记录不能引用",
  reviewed: true,
  idempotencyKey: crypto.randomUUID(),
});
const first = await confirm(f, a, draftA);
assert.equal(
  (await call(p + "/" + a + "/" + draftA.id + "/confirm", "POST", first.body))
    .frozenHash,
  first.row.frozenHash,
);
pass(
  "Partial drafts survive incomplete confirmation; one active draft, frozen staff, stale process fingerprints and cross-supplier record substitution are checked",
);
const originalHash = first.row.frozenHash;
await bad(
  p + "/" + a + "/draft",
  "PUT",
  save({ ...content(f, 0), discussion: "不得覆盖" }, first.row),
);
for (let i = 1; i < 4; i++) {
  const draft = await call(p + "/" + a + "/draft", "PUT", save(content(f, i)));
  await confirm(f, a, draft);
}
let ledgerA = await call(p + "/" + a),
  ledgerB = await call(p + "/" + b);
assert.equal(ledgerA.records.filter((r) => r.status === "confirmed").length, 4);
assert.equal(
  ledgerA.records.find((r) => r.id === first.row.id).frozenHash,
  originalHash,
);
assert.ok(!JSON.stringify(ledgerB).includes("PRIVATE-DISCUSSION-" + a));
assert.ok(!JSON.stringify(await call(p)).includes("PRIVATE-DISCUSSION-"));
assert.ok(
  !JSON.stringify(await call("/execution/packages/" + pkg)).includes(
    "PRIVATE-DISCUSSION-",
  ),
);
await bad(p + "/" + a, "GET", undefined, 403, editor.token);
pass(
  "Four successive communications remain immutable and chronological; supplier ledgers and generic progress/events never mix private discussion text",
);
w = await call(p);
await bad(f.root + "/final-quotes", "POST", finalBody(f, w.fingerprint));
await bad(f.root + "/final-quotes", "POST", finalBody(f, w.fingerprint, [a]));
draftB = await call(
  p + "/" + b + "/draft",
  "PUT",
  save(content(f, 0, b), draftB),
);
await confirm(f, b, draftB);
const readyFp = (await call(p)).fingerprint;
const extra = await call(
  p + "/" + a + "/draft",
  "PUT",
  save({ ...partial, discussion: "草稿作废也保留原内容" }),
);
await bad(f.root + "/final-quotes", "POST", finalBody(f, readyFp), 409);
await bad(p + "/" + a + "/" + extra.id + "/void", "POST", {
  expectedVersion: extra.version,
  reason: "",
  idempotencyKey: crypto.randomUUID(),
});
const vb = {
  expectedVersion: extra.version,
  reason: "合成未执行议题，不覆盖已有四次确认",
  idempotencyKey: crypto.randomUUID(),
};
await call(p + "/" + a + "/" + extra.id + "/void", "POST", vb);
assert.equal(
  (await call(p + "/" + a + "/" + extra.id + "/void", "POST", vb)).contentJson,
  extra.contentJson,
);
w = await call(p);
await bad(f.root + "/final-quotes", "POST", {
  ...finalBody(f, w.fingerprint),
  initiatedAt: new Date(Date.parse(f.openedAt) + 5 * 60000).toISOString(),
});
const start = finalBody(f, w.fingerprint),
  campaign = await call(f.root + "/final-quotes", "POST", start);
assert.equal(
  (await call(f.root + "/final-quotes", "POST", start)).id,
  campaign.id,
);
const manifest = JSON.parse(campaign.discussionManifestJson);
assert.equal(manifest.length, 2);
assert.equal(manifest.find((m) => m.participationId === a).ordinal, 4);
assert.equal(
  manifest.find((m) => m.participationId === a).frozenHash,
  ledgerA.records[0].frozenHash,
);
assert.ok(!JSON.stringify(campaign).includes("PRIVATE-DISCUSSION-"));
await bad(p + "/" + a + "/draft", "PUT", save(content(f, 5)));
await bad(p + "/" + a + "/" + first.row.id + "/void", "POST", {
  expectedVersion: first.row.version,
  reason: "不得倒改",
  idempotencyKey: crypto.randomUUID(),
});
assert.equal(
  (await call(p + "/" + a)).records.find((r) => r.id === extra.id).status,
  "void",
);
pass(
  "Drafts cannot be bypassed by excluding suppliers; void retains content, final initiation follows meeting time and freezes exact latest references without private text",
);
const changed = await make("沟通需求调整阻断验收"),
  cp = changed.root + "/discussions";
await prepareSupplierDiscussions({
  call,
  root: changed.root,
  proofId: proof,
  participantIds: [a, b],
});
let changeDraft = await call(
  cp + "/" + a + "/draft",
  "PUT",
  save(content(changed, 1, a, "requires_authorized_change")),
);
const changeRow = (await confirm(changed, a, changeDraft)).row;
await bad(
  cp + "/" + a + "/draft",
  "PUT",
  save({ ...content(changed, 2), changeDisposition: "approved" }),
);
await bad(
  cp + "/" + a + "/draft",
  "PUT",
  save({ ...content(changed, 1), changeDisposition: "none" }, changeRow),
);
const noChange = await call(
  cp + "/" + a + "/draft",
  "PUT",
  save(content(changed, 2)),
);
await confirm(changed, a, noChange);
w = await call(cp);
assert.equal(
  w.progress.find((p) => p.participationId === a).changePending,
  true,
);
await bad(
  changed.root + "/final-quotes",
  "POST",
  finalBody(changed, w.fingerprint),
);
await bad(
  changed.root + "/final-quotes",
  "POST",
  finalBody(changed, w.fingerprint, [b]),
);
pass(
  "Confirmed requirement-change flags cannot be approved inline, overwritten, hidden by later no-change notes or bypassed through supplier exclusion",
);
const paused = await make("逐家沟通暂停守卫验收"),
  pp = paused.root + "/discussions";
await prepareSupplierDiscussions({
  call,
  root: paused.root,
  proofId: proof,
  participantIds: [a, b],
});
let pd = await call(pp + "/" + a + "/draft", "PUT", save(content(paused, 1)));
const beforePause = (await call(pp)).fingerprint,
  ir = "/evaluation/packages/" + pkg + "/rounds/" + paused.roundId;
const incident = await call(ir + "/incidents", "POST", {
  kind: "network_failure",
  title: "合成逐家沟通暂停",
  occurredAt: new Date(Date.now() - 60000).toISOString(),
  responsibleId: s.userId,
  impactScope: "本轮逐家沟通过程",
  description: "合成故障，不代表实际问题",
  evidenceVersionId: proof,
  effect: "pause",
  restorationConditions: "处理故障并复核基线",
  reviewed: true,
  idempotencyKey: crypto.randomUUID(),
});
await bad(pp + "/" + a + "/draft", "PUT", save(content(paused, 1), pd));
await bad(pp + "/" + a + "/" + pd.id + "/void", "POST", {
  expectedVersion: pd.version,
  reason: "暂停不能改写",
  idempotencyKey: crypto.randomUUID(),
});
await bad(pp + "/" + a + "/" + pd.id + "/confirm", "POST", {
  expectedVersion: pd.version,
  expectedPreviousId: pd.previousId,
  expectedFingerprint: beforePause,
  supplierConfirmationVersionId: proof,
  supplierConfirmationNote: "旧确认",
  reviewed: true,
  idempotencyKey: crypto.randomUUID(),
});
assert.equal((await call(pp + "/" + a)).records[0].contentJson, pd.contentJson);
await call(ir + "/incidents/" + incident.id + "/resolve", "POST", {
  expectedVersion: incident.version,
  handledAt: new Date().toISOString(),
  outcome: "continue_ready",
  evidenceVersionId: proof,
  conditionsChecked: true,
  note: "故障恢复已核对",
  idempotencyKey: crypto.randomUUID(),
});
const iw = await call(ir + "/incidents");
await call(ir + "/control/resume", "POST", {
  expectedVersion: iw.control.version,
  casesFingerprint: iw.casesFingerprint,
  evidenceVersionId: proof,
  reviewed: true,
  reason: "合成独立恢复决定",
  idempotencyKey: crypto.randomUUID(),
});
await bad(
  pp + "/" + a + "/" + pd.id + "/confirm",
  "POST",
  {
    expectedVersion: pd.version,
    expectedPreviousId: pd.previousId,
    expectedFingerprint: beforePause,
    supplierConfirmationVersionId: proof,
    supplierConfirmationNote: "恢复不能沿用旧核对",
    reviewed: true,
    idempotencyKey: crypto.randomUUID(),
  },
  409,
);
await confirm(paused, a, pd);
pass(
  "Pause blocks discussion save/confirm/void while preserving content; separate resume never revives the old confirmation fingerprint",
);
const legacy = JSON.parse(
  await fs.readFile(".p0/p3-discussion-legacy-session.json"),
);
assert.ok(legacy.tenantId.startsWith("agency-assessment-"));
const login = await fetch(base + "/api/v1/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    account: legacy.userId + "@example.com",
    password: "demo123456",
    scope: "BUYER",
    tenantId: legacy.tenantId,
  }),
});
assert.equal(login.status, 200);
legacy.token = (await login.json()).data.accessToken;
const lr =
  "/evaluation/packages/" + legacy.packageId + "/sessions/" + legacy.sessionId;
const lw = await call(lr + "/discussions", "GET", undefined, legacy.token);
assert.equal(lw.mode, "legacy");
const lq = await call(lr + "/final-quotes", "GET", undefined, legacy.token);
assert.deepEqual(JSON.parse(lq.campaign.discussionManifestJson), []);
assert.equal(lq.campaign.discussionFingerprint, null);
assert.ok(
  (
    await call(lr + "/price-calculations", "GET", undefined, legacy.token)
  ).history.some((h) => !h.stale),
);
await bad(
  lr + "/discussions/activate",
  "POST",
  { ...activation(1), evidenceVersionId: legacy.proofId },
  400,
  legacy.token,
);
pass(
  "Pre-migration offline tasks stay explicitly legacy: no fabricated discussion references and no spurious invalidation of their valid price snapshots",
);
const browser = await make("逐家沟通过程浏览器验收");
await fs.writeFile(
  ".p0/p3-discussion-browser-session.json",
  JSON.stringify({ ...s, ...browser }),
  { mode: 0o600 },
);
await fs.writeFile(
  ".p0/p3-discussion-smoke-result.json",
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      scope:
        "synthetic offline supplier-isolated communication and final quote provenance; no online identity, electronic signature, demand-change authorization or automatic notices",
    },
    null,
    2,
  ),
);
console.log("Supplier discussion HTTP passed:", checks.length, "checks");
