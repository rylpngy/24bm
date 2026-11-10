import { prepareSupplierDiscussions } from "./agency-discussion-support.mjs";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {
  prepareMaterialOpening,
  uploadReceiptVersion,
} from "./agency-material-opening-support.mjs";
const s = JSON.parse(await fs.readFile(".p0/p3-quote-browser-session.json")),
  editor = JSON.parse(await fs.readFile(".p0/p3-opening-editor-session.json"));
assert.ok(
  s.tenantId.startsWith("agency-assessment-"),
  "Only isolated synthetic tenants are allowed",
);
const base = "http://127.0.0.1:18080",
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
  const out = await r.json();
  if (r.status !== 200) throw Error("failed: " + r.status + " " + out.message);
  return out.data;
}
const bad = (p, m, b, status = 400, token = s.token) =>
  assert.rejects(() => call(p, m, b, token), new RegExp("failed: " + status));
for (let i = 0; i < 120; i++) {
  try {
    const r = await fetch(base + "/actuator/health");
    if (r.ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
const pkg = s.packageId,
  detail = await call("/packages/" + pkg);
assert.equal(detail.record.procurementMethod, "竞争性磋商");
const rounds = await call("/evaluation/packages/" + pkg + "/rounds"),
  source = rounds.rounds.find((r) => r.round.id === s.roundId);
assert.ok(source);
async function make(title) {
  const config = {
    ...source.config,
    title: title + " " + Date.now(),
    members: [
      { userId: s.userId, roles: ["organizer"] },
      { userId: editor.userId, roles: ["review_member"] },
    ],
    rules: source.config.rules.filter(
      (r) =>
        r.configuredRule.stage === "technical" ||
        r.configuredRule.stage === "commercial",
    ),
  };
  assert.ok(config.rules.length);
  let round = await call("/evaluation/packages/" + pkg + "/rounds", "POST", {
    expectedVersion: 0,
    config,
    reason: "最后报价合成技术验收专用规则，仅验证程序",
    idempotencyKey: crypto.randomUUID(),
  });
  round = await call(
    "/evaluation/packages/" + pkg + "/rounds/" + round.round.id + "/freeze",
    "POST",
    {
      expectedVersion: round.round.version,
      businessRulesReviewed: true,
      reason: "人工核对合成规则",
      idempotencyKey: crypto.randomUUID(),
    },
  );
  const opened = await prepareMaterialOpening({
    call,
    headers,
    pkg,
    round: round.round.id,
    participantIds: s.suppliers.map((v) => v.id),
    proofId: s.proofId,
    clock: Date.now() - 7200000,
  });
  const session = await call(
    "/evaluation/packages/" + pkg + "/rounds/" + round.round.id + "/assessment",
    "POST",
    {
      expectedRoundVersion: round.round.version,
      participationIds: s.suppliers.map((v) => v.id),
      openingEvidenceVersionId: s.proofId,
      openedAt: opened.opening.openedAt,
      openingReviewed: true,
      note: "最后报价技术验证，不作实际采购依据",
      idempotencyKey: crypto.randomUUID(),
    },
  );
  return {
    roundId: round.round.id,
    sessionId: session.id,
    path:
      "/evaluation/packages/" +
      pkg +
      "/sessions/" +
      session.id +
      "/final-quotes",
  };
}
const [a, b] = s.suppliers.map((v) => v.id),
  now = Date.now();
const start = (cutoff = new Date(now - 60000).toISOString()) => ({
  participationIds: [a, b],
  exclusions: {},
  initiatedAt: new Date(now - 3600000).toISOString(),
  cutoffAt: cutoff,
  requirementsVersionId: s.proofId,
  noticeVersionId: s.proofId,
  reviewed: true,
  reason: "合成线下最终需求、最终响应条件和通知核对，不作实际适用认定",
  idempotencyKey: crypto.randomUUID(),
});
const receiving = (at = new Date(now - 120000).toISOString(), id = a) => ({
  participationId: id,
  fileName: "最后报价合成.txt",
  amount: "150.00",
  currency: "CNY",
  receivedAt: at,
  originalType: "electronic_copy",
  sourceNote: "线下最终响应及报价合成电子副本，不代表供应商身份",
  lateEntryReason: "合成补录：真实接收时点已核对",
  idempotencyKey: crypto.randomUUID(),
});
const confirm = (w, decisions) => ({
  expectedVersion: w.campaign.version,
  receiptFingerprint: w.receiptFingerprint,
  decisions,
  evidenceVersionId: s.proofId,
  reviewed: true,
  note: "逐家核对合成最终响应；未提交者按依据记录，未授权自动继续评审",
  idempotencyKey: crypto.randomUUID(),
});
const future = await make("最后报价截止前保护");
let body = {
  ...start(new Date(Date.now() + 3600000).toISOString()),
  discussionFingerprint: await prepareSupplierDiscussions({
    call,
    root: future.path.replace(/\/final-quotes$/, ""),
    proofId: s.proofId,
    participantIds: [a, b],
  }),
};
await bad(future.path, "POST", { ...body, reviewed: false });
await bad(future.path, "POST", { ...body, participationIds: ["foreign"] });
await bad(future.path, "POST", { ...body, cutoffAt: body.initiatedAt });
await bad(future.path, "POST", {
  ...body,
  initiatedAt: new Date(now - 10800000).toISOString(),
});
await call(future.path, "POST", body);
let w = await call(future.path);
await bad(
  future.path + "/confirm",
  "POST",
  confirm(
    w,
    [a, b].map((id) => ({
      participationId: id,
      receiptId: null,
      status: "not_submitted",
      reason: "合成未提交处理",
    })),
  ),
);
pass(
  "Unreviewed starts, foreign scopes, invalid windows and confirmation before the real deadline are blocked",
);
const f = await make("最后报价接口技术验收");
await bad(f.path, "GET", undefined, 403, editor.token);
body = {
  ...start(),
  discussionFingerprint: await prepareSupplierDiscussions({
    call,
    root: f.path.replace(/\/final-quotes$/, ""),
    proofId: s.proofId,
    participantIds: [a, b],
  }),
};
const campaign = await call(f.path, "POST", body);
assert.equal((await call(f.path, "POST", body)).id, campaign.id);
await bad(f.path, "POST", { ...body, reason: "different" }, 409);
await bad(f.path, "POST", start());
pass(
  "Only frozen organizers access final quotes; initiation is immutable and idempotent",
);
await bad(f.path + "/receipts", "POST", {
  ...receiving(),
  lateEntryReason: "",
});
await bad(
  f.path + "/receipts",
  "POST",
  receiving(new Date(now + 3600000).toISOString()),
);
await bad(f.path + "/receipts", "POST", { ...receiving(), currency: "USD" });
await bad(f.path + "/receipts", "POST", { ...receiving(), amount: "1.001" });
pass(
  "Receipt time, late-entry evidence, decimal precision and package currency are checked",
);
const receiveBody = receiving();
const row = await call(f.path + "/receipts", "POST", receiveBody);
assert.equal(
  (await call(f.path + "/receipts", "POST", receiveBody)).receipt.id,
  row.receipt.id,
);
await bad(f.path + "/receipts", "POST", receiving());
const v = row.file.versions[0];
w = await call(f.path);
const accepted = [
  {
    participationId: a,
    receiptId: row.receipt.id,
    status: "accepted",
    reason: "核对按时最终响应及报价合成副本",
  },
  {
    participationId: b,
    receiptId: null,
    status: "not_submitted",
    reason: "未提交最后报价，不使用初次报价顶替；后续按适用规则另行处理",
  },
];
await bad(f.path + "/confirm", "POST", confirm(w, accepted));
await bad("/files/" + row.file.file.id + "/versions", "POST", {
  expectedOrdinal: 1,
  reason: "不得追加受控副本",
});
pass(
  "One active receipt per subject, exact retry, mandatory sealing and protected version immutability",
);
const old = w;
const attachment = await uploadReceiptVersion(
  v.id,
  "最后报价合成.txt",
  "合成最终响应及最后报价150.00，非实际采购材料。",
  headers,
);
for (const token of [s.token, editor.token]) {
  const r = await fetch(
    base + "/api/v1/buyer/attachments/" + attachment.id + "/download",
    { headers: { authorization: "Bearer " + token } },
  );
  assert.equal(r.status, 403);
}
await bad("/execution/packages/" + pkg + "/extractions", "POST", {
  sourceVersionIds: [v.id],
  idempotencyKey: crypto.randomUUID(),
});
pass(
  "Creator and wildcard reviewer cannot download unconfirmed content; generic document reuse is refused",
);
await bad(f.path + "/confirm", "POST", confirm(old, accepted), 409);
w = await call(f.path);
await bad(f.path + "/confirm", "POST", confirm(w, accepted.slice(0, 1)));
await bad(
  f.path + "/confirm",
  "POST",
  confirm(w, [
    { ...accepted[0], status: "not_submitted", receiptId: null },
    accepted[1],
  ]),
);
pass(
  "Changed sealed bytes invalidate old confirmation; missing subjects and false non-submission are rejected",
);
const quotePath =
  "/evaluation/packages/" + pkg + "/sessions/" + f.sessionId + "/quotes";
const initial = await call(quotePath, "POST", {
  participationId: a,
  kind: "original",
  amount: "100.00",
  currency: "CNY",
  evidenceVersionId: s.proofId,
  reason: "合成初次报价对照",
  reviewed: true,
  idempotencyKey: crypto.randomUUID(),
});
const confirmedBody = confirm(w, accepted);
const result = await call(f.path + "/confirm", "POST", confirmedBody);
assert.equal(
  (await call(f.path + "/confirm", "POST", confirmedBody)).id,
  result.id,
);
w = await call(f.path);
assert.equal(w.results.find((r) => r.participationId === a).amount, "150.00");
assert.equal(w.results.find((r) => r.participationId === b).amount, null);
assert.equal(
  (await call(quotePath)).find((r) => r.id === initial.id).originalAmount,
  "100.00",
);
pass(
  "A final quote higher than the initial price is retained; missing final quote stays null and initial price stays unchanged",
);
const download = await fetch(
  base + "/api/v1/buyer/attachments/" + attachment.id + "/download",
  { headers: { authorization: "Bearer " + s.token } },
);
assert.equal(download.status, 200);
assert.match(await download.text(), /150.00/);
const deniedDownload = await fetch(
  base + "/api/v1/buyer/attachments/" + attachment.id + "/download",
  { headers: { authorization: "Bearer " + editor.token } },
);
assert.equal(deniedDownload.status, 403);
await bad(f.path + "/receipts", "POST", receiving());
await bad(f.path + "/receipts/" + row.receipt.id + "/withdraw", "POST", {
  expectedVersion: w.campaign.version,
  reason: "确认后不能撤回",
  idempotencyKey: crypto.randomUUID(),
});
pass(
  "Only confirmed exact accepted bytes are released to authorized organizers; confirmation locks receiving and withdrawal",
);
const late = await make("最后报价逾期及撤回验证");
await call(late.path, "POST", {
  ...start(),
  discussionFingerprint: await prepareSupplierDiscussions({
    call,
    root: late.path.replace(/\/final-quotes$/, ""),
    proofId: s.proofId,
    participantIds: [a, b],
  }),
});
let lateRow = await call(
  late.path + "/receipts",
  "POST",
  receiving(new Date(now - 30000).toISOString()),
);
w = await call(late.path);
const withdraw = {
  expectedVersion: w.campaign.version,
  reason: "合成登记错误，保留原件及旧值",
  idempotencyKey: crypto.randomUUID(),
};
const withdrawn = await call(
  late.path + "/receipts/" + lateRow.receipt.id + "/withdraw",
  "POST",
  withdraw,
);
assert.equal(withdrawn.status, "withdrawn");
assert.equal(
  (
    await call(
      late.path + "/receipts/" + lateRow.receipt.id + "/withdraw",
      "POST",
      withdraw,
    )
  ).status,
  "withdrawn",
);
lateRow = await call(
  late.path + "/receipts",
  "POST",
  receiving(new Date(now - 30000).toISOString()),
);
const la = await uploadReceiptVersion(
  lateRow.file.versions[0].id,
  "最后报价合成.txt",
  "合成逾期最后报价，不作为有效报价。",
  headers,
);
w = await call(late.path);
let decisions = [
  {
    participationId: a,
    receiptId: lateRow.receipt.id,
    status: "accepted",
    reason: "不能接受逾期",
  },
  {
    participationId: b,
    receiptId: null,
    status: "not_submitted",
    reason: "未提交的合成处理依据",
  },
];
await bad(late.path + "/confirm", "POST", confirm(w, decisions));
decisions[0] = {
  ...decisions[0],
  status: "late",
  reason: "逾期接收按依据不作为有效最后报价，另行办理异常程序",
};
await call(late.path + "/confirm", "POST", confirm(w, decisions));
w = await call(late.path);
assert.equal(w.receipts.length, 2);
assert.equal(w.results[0].amount, null);
const ld = await fetch(
  base + "/api/v1/buyer/attachments/" + la.id + "/download",
  { headers: { authorization: "Bearer " + s.token } },
);
assert.equal(ld.status, 403);
pass(
  "Wrong receipt withdrawal preserves history; late material never becomes an accepted price or downloadable accepted response",
);
const browser = await make("最后报价浏览器技术验收");
await prepareSupplierDiscussions({
  call,
  root: browser.path.replace(/\/final-quotes$/, ""),
  proofId: s.proofId,
  participantIds: [a, b],
});
await fs.writeFile(
  ".p0/p3-final-quote-browser-session.json",
  JSON.stringify({ ...s, ...browser }),
  { mode: 0o600 },
);
await fs.writeFile(
  ".p0/p3-final-quote-smoke-result.json",
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      scope:
        "isolated synthetic consultation offline final quotes; negotiation method gate unit-tested; no supplier identity, notification sending, ranking or award",
    },
    null,
    2,
  ),
);
console.log("Final quote HTTP passed:", checks.length, "checks");
