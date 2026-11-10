import { prepareMaterialOpening } from "./agency-material-opening-support.mjs";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const s = JSON.parse(await fs.readFile(".p0/p3-opening-browser-session.json")),
  editor = JSON.parse(await fs.readFile(".p0/p3-opening-editor-session.json")),
  b = JSON.parse(await fs.readFile(".p0/p3-opening-browser-result.json"));
assert.ok(s.tenantId.startsWith("agency-assessment-"));
let root = `/evaluation/packages/${s.packageId}/sessions/${b.sessionId}/quotes`;
const checks = [];
const pass = (t) => {
  checks.push(t);
  console.log("PASS", t);
};
async function call(path, method = "GET", body, token = s.token) {
  const r = await fetch("http://127.0.0.1:18080/api/v1/buyer/agency" + path, {
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
const subject = s.suppliers[0].id;
const body = (kind, amount, previous = null) => ({
  participationId: subject,
  expectedPreviousId: previous,
  kind,
  amount,
  currency: "CNY",
  evidenceVersionId: s.proofId,
  reason: "合成报价分层技术验证，不是实际报价或政策认定",
  reviewed: true,
  idempotencyKey: crypto.randomUUID(),
});
for (let i = 0; i < 120; i++) {
  try {
    const r = await fetch("http://127.0.0.1:18080/actuator/health");
    if (r.ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
const rounds = await call("/evaluation/packages/" + s.packageId + "/rounds");
const template = rounds.rounds.find((r) => r.round.id === s.roundId);
let fresh = await call(
  "/evaluation/packages/" + s.packageId + "/rounds",
  "POST",
  {
    expectedVersion: 0,
    config: { ...template.config, title: "报价分层技术验收 " + Date.now() },
    reason: "合成价格技术检查独立轮次",
    idempotencyKey: crypto.randomUUID(),
  },
);
fresh = await call(
  "/evaluation/packages/" +
    s.packageId +
    "/rounds/" +
    fresh.round.id +
    "/freeze",
  "POST",
  {
    expectedVersion: fresh.round.version,
    businessRulesReviewed: true,
    reason: "合成规则核对",
    idempotencyKey: crypto.randomUUID(),
  },
);
const opened = await prepareMaterialOpening({
  call,
  headers: () => ({
    authorization: "Bearer " + s.token,
    "content-type": "application/json",
  }),
  pkg: s.packageId,
  round: fresh.round.id,
  participantIds: s.suppliers.map((v) => v.id),
  proofId: s.proofId,
});
const session = await call(
  "/evaluation/packages/" +
    s.packageId +
    "/rounds/" +
    fresh.round.id +
    "/assessment",
  "POST",
  {
    expectedRoundVersion: fresh.round.version,
    participationIds: s.suppliers.map((v) => v.id),
    openingEvidenceVersionId: s.proofId,
    openedAt: opened.opening.openedAt,
    openingReviewed: true,
    note: "合成价格分层检查",
    idempotencyKey: crypto.randomUUID(),
  },
);
b.sessionId = session.id;
root = `/evaluation/packages/${s.packageId}/sessions/${session.id}/quotes`;
await fs.writeFile(
  ".p0/p3-quote-browser-session.json",
  JSON.stringify({ ...s, roundId: fresh.round.id, sessionId: session.id }),
  { mode: 0o600 },
);
await assert.rejects(
  () => call(root, "GET", undefined, editor.token),
  /failed: 403/,
);
pass(
  "A frozen reviewer with wildcard permissions cannot read organizer quote records",
);
for (const amount of ["-1", "1.001", "1000000000000000000.00"])
  await assert.rejects(
    () => call(root, "POST", body("original", amount)),
    /failed: 400/,
  );
await assert.rejects(
  () => call(root, "POST", { ...body("original", "1"), reviewed: false }),
  /failed: 400/,
);
pass("Negative, rounded, overflowing and unreviewed amounts are rejected");
// Use a new opened subject on repeat only when the prior chain is empty; preserves previous evidence.
const existing = await call(root);
let prior = existing.find((r) => r.participationId === subject);
if (!prior) {
  const first = body("original", "100.00");
  prior = await call(root, "POST", first);
  assert.equal((await call(root, "POST", first)).id, prior.id);
}
assert.equal(Number(prior.originalAmount), 100);
pass("Original quote is recorded once with idempotent retry");
await assert.rejects(
  () => call(root, "POST", body("original", "101", prior.id)),
  /failed: 400/,
);
await assert.rejects(
  () => call(root, "POST", body("correction", "99", "stale")),
  /failed: 409/,
);
await assert.rejects(
  () =>
    call(root, "POST", {
      ...body("correction", "99", prior.id),
      currency: "USD",
    }),
  /failed: 400/,
);
pass("Original overwrite, stale predecessors and mixed currencies are blocked");
let correction = await call(
  root,
  "POST",
  body("correction", "99.00", prior.id),
);
let policy = await call(root, "POST", body("policy", "89.10", correction.id));
assert.equal(Number(policy.originalAmount), 100);
assert.equal(Number(policy.correctedAmount), 99);
assert.equal(Number(policy.evaluationAmount), 89.1);
pass(
  "Original, corrected and policy review prices remain separate exact decimal layers",
);
const newCorrection = await call(
  root,
  "POST",
  body("correction", "98.00", policy.id),
);
assert.equal(newCorrection.evaluationAmount, null);
const history = await call(root);
assert.equal(
  Number(history.find((r) => r.id === policy.id).evaluationAmount),
  89.1,
);
assert.equal(
  Number(history.find((r) => r.id === correction.id).correctedAmount),
  99,
);
pass(
  "A new correction invalidates the current policy layer while immutable earlier prices remain",
);
await assert.rejects(
  () => call(root, "POST", body("final", "97", newCorrection.id)),
  /failed: 400/,
);
await assert.rejects(
  () =>
    call(root, "POST", {
      ...body("policy", "90", newCorrection.id),
      participationId: "foreign",
    }),
  /failed: 400/,
);
pass(
  "Unsupported final quotes and foreign opening subjects cannot enter this first-quote ledger",
);
await fs.writeFile(
  ".p0/p3-quote-smoke-result.json",
  JSON.stringify(
    {
      checks,
      passed: checks.length,
      sessionId: b.sessionId,
      scope:
        "synthetic manual first-quote layers; no policy calculation, ranking or contract value",
    },
    null,
    2,
  ),
);
