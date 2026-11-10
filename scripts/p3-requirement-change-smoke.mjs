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
    reason: "授权变更合成技术验证，不作实际规则",
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
async function req(path, method, body) {
  const r = await fetch(base + path, {
    method,
    headers: headers(),
    body: JSON.stringify(body),
  });
  const j = await r.json();
  assert.ok(r.ok, `attachment ${r.status}`);
  return j.data;
}
async function upload(name, text, visibility = "project") {
  const f = await call(`/packages/${pkg}/files`, "POST", {
      name,
      category: "demand_source",
      visibility,
    }),
    v = f.versions[0],
    body = {
      ownerType: "agency_file_version",
      ownerId: v.id,
      fileName: name,
      visibility: "buyer_internal",
    };
  const ticket = await req(
    "/api/v1/buyer/attachments/upload-ticket",
    "POST",
    body,
  );
  const r = await fetch(base + ticket.uploadUrl, {
    method: "POST",
    headers: {
      authorization: "Bearer " + s.token,
      "content-type": "application/octet-stream",
    },
    body: Buffer.from(text),
  });
  assert.equal(r.status, 200);
  const att = await req("/api/v1/buyer/attachments", "POST", {
    ...body,
    storageKey: ticket.storageKey,
  });
  return call(`/file-versions/${v.id}/seal`, "POST", { attachmentId: att.id });
}
const requirements = await upload(
    "合成最终共同需求V1.txt",
    "技术服务报告增加可编辑交付副本。合成验证，不作实际采购规则。",
  ),
  requirements2 = await upload(
    "合成最终共同需求V2.txt",
    "技术服务报告增加可编辑交付副本及格式索引。合成验证。",
  ),
  notice = await upload(
    "合成共同变更通知.txt",
    "向全部冻结参与者送达同一版本共同需求；此文不含逐家私有回应。",
  ),
  authorization = await upload(
    "合成外部授权凭证.txt",
    "合成采购人授权代表书面确认；仅用于技术验收。",
  ),
  restricted = await upload(
    "合成受限授权.txt",
    "私有材料不得冒充共同发布内容",
    "restricted",
  );
async function pending(f, index = 1) {
  const cp = f.root + "/discussions";
  const row = await call(
    cp + "/" + a + "/draft",
    "PUT",
    save(content(f, index, a, "requires_authorized_change")),
  );
  return (await confirm(f, a, row)).row;
}
async function prepared(title) {
  const f = await make(title);
  await prepareSupplierDiscussions({
    call,
    root: f.root,
    proofId: proof,
    participantIds: [a, b],
  });
  const source = await pending(f);
  return { ...f, sourceId: source.id };
}
const f = await prepared("授权需求变更接口验收"),
  p = f.root + "/requirement-changes";
const get = () => call(p),
  fp = async () => (await get()).fingerprint;
const body = async (overrides = {}) => ({
  expectedFingerprint: await fp(),
  kind: "technical",
  locator: "第3条合成交付要求",
  beforeText: "仅提交PDF报告",
  afterText: "增加可编辑交付副本",
  authorityName: "合成采购人授权代表",
  authorityRole: "书面授权代表",
  authorityScope: "合成授权书规定的技术交付要求范围；不替代真实确认",
  authorizationVersionId: authorization.id,
  authorizedAt: new Date(Date.parse(f.openedAt) + 50 * 60000).toISOString(),
  requirementsVersionId: requirements.id,
  noticeVersionId: notice.id,
  sentAt: new Date(Date.parse(f.openedAt) + 55 * 60000).toISOString(),
  channel: "线下同一批次签收，人工核对",
  responseDeadlineAt: new Date(Date.now() + 30 * 60000).toISOString(),
  limitsReviewed: true,
  publicContentReviewed: true,
  adequateTimeReviewed: true,
  reason: "合成外部授权及统一通知凭证核对，不代表实际业务",
  idempotencyKey: crypto.randomUUID(),
  ...overrides,
});
const register = async (id, participant, overrides = {}) => ({
  expectedFingerprint: await fp(),
  participationId: participant,
  expectedPreviousId: null,
  receivedAt: new Date(Date.parse(f.openedAt) + 60 * 60000).toISOString(),
  recipient: "合成" + participant + "接收人及身份来源",
  evidenceVersionId: proof,
  note: "人工核对本对象收到同一冻结通知和共同需求",
  replacementReason: "",
  contentChecked: true,
  idempotencyKey: crypto.randomUUID(),
  ...overrides,
});
const complete = async (overrides = {}) => ({
  expectedFingerprint: await fp(),
  reviewed: true,
  evidenceVersionId: proof,
  note: "人工核对全部冻结对象同一通知内容及逐家送达凭证",
  idempotencyKey: crypto.randomUUID(),
  ...overrides,
});
await bad(p, "GET", undefined, 403, editor.token);
await bad(
  "/evaluation/packages/foreign/sessions/" +
    f.sessionId +
    "/requirement-changes",
  "GET",
  undefined,
  403,
);
for (const patch of [
  { kind: "qualification" },
  { kind: "scoring" },
  { limitsReviewed: false },
  { publicContentReviewed: false },
  { adequateTimeReviewed: false },
  { afterText: "仅提交PDF报告" },
  { authorityName: "" },
  { authorizedAt: f.openedAt },
  { authorizationVersionId: restricted.id },
  { noticeVersionId: restricted.id },
])
  await bad(p, "POST", await body(patch));
await bad(p, "POST", await body({ expectedFingerprint: "stale" }), 409);
await bad(
  f.root + "/final-quotes",
  "POST",
  finalBody(f, (await call(f.root + "/discussions")).fingerprint),
);
pass(
  "External authority evidence, explicit permitted scope/privacy/time review, sealed public sources, frozen organizer and tenant/session access are enforced",
);
const d = await body(),
  change = await call(p, "POST", d);
assert.equal((await call(p, "POST", d)).id, change.id);
assert.equal(change.status, "authorized");
const snapshot = JSON.parse(change.snapshotJson);
assert.deepEqual(
  new Set(snapshot.subjects.map((v) => v.participationId)),
  new Set([a, b]),
);
assert.equal(snapshot.sourceRecords[0].recordId, f.sourceId);
assert.ok(!change.snapshotJson.includes("PRIVATE-DISCUSSION"));
await bad(p, "POST", await body());
await bad(p + "/" + change.id + "/complete", "POST", await complete());
await bad(
  f.root + "/final-quotes",
  "POST",
  finalBody(f, (await call(f.root + "/discussions")).fingerprint, [a]),
);
pass(
  "Immutable idempotent authorization freezes common documents and all recipients; neither partial coverage nor final-quote exclusions bypass notification",
);
const ra = await register(change.id, a);
for (const patch of [
  { participationId: "foreign" },
  { contentChecked: false },
  { receivedAt: f.openedAt },
  { evidenceVersionId: restricted.id },
])
  await bad(p + "/" + change.id + "/receipts", "POST", {
    ...ra,
    ...patch,
    idempotencyKey: crypto.randomUUID(),
  });
const receiptA = await call(p + "/" + change.id + "/receipts", "POST", ra);
assert.equal(
  (await call(p + "/" + change.id + "/receipts", "POST", ra)).id,
  receiptA.id,
);
await bad(p + "/" + change.id + "/complete", "POST", await complete());
await bad(
  p + "/" + change.id + "/receipts",
  "POST",
  { ...ra, participationId: b, idempotencyKey: crypto.randomUUID() },
  409,
);
await bad(
  p + "/" + change.id + "/receipts",
  "POST",
  await register(change.id, a),
  409,
);
const correction = await register(change.id, a, {
  expectedPreviousId: receiptA.id,
});
await bad(p + "/" + change.id + "/receipts", "POST", correction);
const amended = await call(p + "/" + change.id + "/receipts", "POST", {
  ...correction,
  replacementReason: "合成追加更正接收人说明，旧版不覆盖",
  recipient: "合成甲经核对的接收人",
});
assert.equal(amended.previousId, receiptA.id);
assert.equal(amended.ordinal, 2);
const rB = await call(
  p + "/" + change.id + "/receipts",
  "POST",
  await register(change.id, b),
);
let w = await get();
assert.equal(w.receipts.length, 3);
assert.equal(
  w.receipts.find((v) => v.id === receiptA.id).frozenHash,
  receiptA.frozenHash,
);
assert.ok((await call(f.root + "/discussions")).blockers.length > 0);
pass(
  "Per-recipient current fingerprints and predecessor checks protect receipts; append-only corrections preserve original facts and do not auto-complete the batch",
);
const beforePause = await complete(),
  oldReg = await register(change.id, b, {
    expectedPreviousId: rB.id,
    replacementReason: "合成追加更正",
  }),
  ir = "/evaluation/packages/" + pkg + "/rounds/" + f.roundId;
const incident = await call(ir + "/incidents", "POST", {
  kind: "network_failure",
  title: "合成通知复核暂停",
  occurredAt: new Date(Date.now() - 60000).toISOString(),
  responsibleId: s.userId,
  impactScope: "本轮授权变更及通知",
  description: "合成故障边界",
  evidenceVersionId: proof,
  effect: "pause",
  restorationConditions: "处理并独立恢复",
  reviewed: true,
  idempotencyKey: crypto.randomUUID(),
});
await bad(p + "/" + change.id + "/complete", "POST", beforePause);
await bad(p + "/" + change.id + "/receipts", "POST", oldReg);
await bad(p, "POST", await body());
assert.equal((await get()).receipts.length, 3);
await call(ir + "/incidents/" + incident.id + "/resolve", "POST", {
  expectedVersion: incident.version,
  handledAt: new Date().toISOString(),
  outcome: "continue_ready",
  evidenceVersionId: proof,
  conditionsChecked: true,
  note: "合成故障处理",
  idempotencyKey: crypto.randomUUID(),
});
w = await call(ir + "/incidents");
await call(ir + "/control/resume", "POST", {
  expectedVersion: w.control.version,
  casesFingerprint: w.casesFingerprint,
  evidenceVersionId: proof,
  reviewed: true,
  reason: "合成独立恢复",
  idempotencyKey: crypto.randomUUID(),
});
await bad(p + "/" + change.id + "/complete", "POST", beforePause, 409);
await bad(p + "/" + change.id + "/receipts", "POST", oldReg, 409);
await bad(
  p + "/" + change.id + "/complete",
  "POST",
  await complete({ reviewed: false }),
);
const cb = await complete(),
  done = await call(p + "/" + change.id + "/complete", "POST", cb);
assert.equal(
  (await call(p + "/" + change.id + "/complete", "POST", cb)).completionHash,
  done.completionHash,
);
assert.equal(done.status, "notified");
assert.equal(done.frozenHash, change.frozenHash);
assert.deepEqual(
  new Set(JSON.parse(done.completionJson).receipts.map((v) => v.id)),
  new Set([amended.id, rB.id]),
);
await bad(
  p + "/" + change.id + "/receipts",
  "POST",
  await register(change.id, b),
);
assert.equal((await get()).pendingSources.length, 0);
assert.equal(
  (await call(f.root + "/discussions")).progress.find(
    (v) => v.participationId === a,
  ).changePending,
  false,
);
pass(
  "Pause blocks every mutation and preserves history; resume invalidates old review fingerprints; explicit all-recipient reconciliation locks exact latest receipt hashes",
);
await pending(f, 3);
w = await call(f.root + "/discussions");
assert.equal(
  w.progress.find((v) => v.participationId === a).changePending,
  true,
);
await bad(f.root + "/final-quotes", "POST", finalBody(f, w.fingerprint));
await bad(p, "POST", await body());
const d2 = await body({
  requirementsVersionId: requirements2.id,
  authorizedAt: new Date(Date.parse(f.openedAt) + 60 * 60000).toISOString(),
  sentAt: new Date(Date.parse(f.openedAt) + 65 * 60000).toISOString(),
  afterText: "增加可编辑交付副本及格式索引",
});
const change2 = await call(p, "POST", d2);
assert.equal(JSON.parse(change2.snapshotJson).previousHash, change.frozenHash);
assert.equal(JSON.parse(change2.snapshotJson).sourceRecords.length, 1);
for (const participant of [a, b])
  await call(
    p + "/" + change2.id + "/receipts",
    "POST",
    await register(change2.id, participant, {
      receivedAt: new Date(Date.parse(f.openedAt) + 70 * 60000).toISOString(),
    }),
  );
const done2 = await call(
  p + "/" + change2.id + "/complete",
  "POST",
  await complete(),
);
pass(
  "A later pending change cannot reuse earlier coverage; each subsequent addendum requires a new requirements version, new all-recipient receipts and a linked immutable snapshot",
);
w = await call(f.root + "/discussions");
assert.equal(w.blockers.length, 0);
const final = {
  ...finalBody(f, w.fingerprint),
  requirementsVersionId: requirements2.id,
};
await bad(f.root + "/final-quotes", "POST", {
  ...final,
  requirementsVersionId: requirements.id,
});
await bad(f.root + "/final-quotes", "POST", {
  ...final,
  initiatedAt: new Date(Date.parse(f.openedAt) + 66 * 60000).toISOString(),
});
await bad(f.root + "/final-quotes", "POST", {
  ...final,
  cutoffAt: new Date(Date.now() + 5 * 60000).toISOString(),
});
const campaign = await call(f.root + "/final-quotes", "POST", final),
  refs = JSON.parse(campaign.requirementChangesJson);
assert.deepEqual(refs, [
  { id: change.id, hash: done.completionHash },
  { id: change2.id, hash: done2.completionHash },
]);
assert.ok(!JSON.stringify(campaign).includes("PRIVATE-DISCUSSION"));
assert.ok(!JSON.stringify(campaign).includes("合成甲经核对"));
await bad(p, "POST", await body());
await bad(
  p + "/" + change2.id + "/receipts",
  "POST",
  await register(change2.id, b),
);
await bad(p + "/" + change2.id + "/complete", "POST", await complete());
const events = await call("/execution/packages/" + pkg);
assert.ok(!JSON.stringify(events).includes("合成甲经核对的接收人"));
assert.ok(!JSON.stringify(events).includes("PRIVATE-DISCUSSION"));
pass(
  "Final quote requires the latest notified requirements and timing window, freezes both completed addenda, keeps private facts out of generic events and forbids backfilling after initiation",
);
const browserFixture = await prepared("授权需求变更浏览器验收");
await fs.writeFile(
  ".p0/p3-requirement-change-browser-session.json",
  JSON.stringify({
    ...s,
    ...browserFixture,
    requirementsVersionId: requirements.id,
    authorizationVersionId: authorization.id,
    noticeVersionId: notice.id,
  }),
  { mode: 0o600 },
);
await fs.writeFile(
  ".p0/p3-requirement-change-smoke-result.json",
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      scope:
        "Synthetic offline external-authority evidence and all-frozen-recipient notification reconciliation; no automatic message sending, legal validation, scoring/qualification changes or supplier authentication",
    },
    null,
    2,
  ),
);
console.log("PASS total", checks.length);
