import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { fixture, uploadProof } from "./agency-technical-fixture.mjs";
const f = await fixture(".p0/p4-post-session.json"),
  { s, call, bad, key, definition, approve } = f,
  p = `/packages/${s.packageId}/finance`,
  checks = [],
  pass = (t) => {
    checks.push(t);
    console.log("PASS", t);
  };
await definition("agency_finance_review");
const before = await call(`/packages/${s.packageId}`),
  proof = await uploadProof(
    f,
    "合成计费约定核对.txt",
    "合成已到约定节点，固定服务费100，折扣1；" + key(),
  );
let a = await call(p + "/receivables", "POST", {
  formula: "fixed",
  base: null,
  rate: null,
  fixedAmount: "100.00",
  discount: "1",
  ruleVersion: "SYNTHETIC-FEE-V1",
  ruleBasis: "实际立项收费约定人工核对",
  taxBasis: "含税合成口径，不构成税务建议",
  trigger: "合成已达到合同约定确认节点",
  payer: "合成实际付款主体",
  recipient: "合成代理公司",
  evidenceVersionId: proof.id,
  reviewed: true,
  idempotencyKey: key(),
});
assert.equal(a.status, "draft");
assert.equal((await call(p)).summary.receivable, "0");
await bad(p + `/accounts/${a.id}/entries`, "POST", {
  kind: "receipt",
  amount: "100",
  reviewed: true,
});
a = await call(p + `/accounts/${a.id}/submit`, "POST", {
  expectedVersion: a.version,
  reason: "合成独立核算",
  idempotencyKey: key(),
});
await approve(a.id);
let w = await call(p);
assert.equal(w.summary.receivable, "100.00");
pass(
  "Fee agreement and precise calculation freeze before actual independent Flowable approval; pending calculation never becomes confirmed receivable",
);
async function entry(account, kind, amount, ref, proofId) {
  const ev = proofId
    ? { id: proofId }
    : await uploadProof(
        f,
        "合成财务-" + ref + ".txt",
        "合成实际凭证 " + kind + " " + amount + " " + key(),
      );
  return call(p + `/accounts/${account}/entries`, "POST", {
    kind,
    amount,
    occurredAt: new Date().toISOString(),
    evidenceVersionId: ev.id,
    counterparty: "合成实际往来主体",
    reference: ref,
    reason: "人工核对真实凭证，重复检查",
    reviewed: true,
    duplicateReviewed: false,
    idempotencyKey: key(),
  });
}
await entry(a.id, "invoice", "100", "invoice");
assert.equal((await call(p)).summary.received, "0");
const receipt = await entry(a.id, "receipt", "120", "receipt");
await bad(p + `/accounts/${a.id}/entries`, "POST", {
  kind: "receipt",
  amount: "120",
  occurredAt: new Date().toISOString(),
  evidenceVersionId: receipt.evidenceVersionId,
  counterparty: "合成实际往来主体",
  reference: "duplicate",
  reason: "重复凭证不能重复入账",
  reviewed: true,
  duplicateReviewed: true,
  idempotencyKey: key(),
});
w = await call(p);
assert.equal(w.summary.overpaid, "20.00");
await entry(a.id, "refund", "20", "refund");
w = await call(p);
assert.equal(w.summary.outstanding, "0.00");
assert.equal(w.summary.overpaid, "0.00");
pass(
  "Invoice is separate from cash; real overpayment remains visible, actual refund reconciles it, same proof cannot be counted twice",
);
const cproof = await uploadProof(
  f,
  "合成交通费用申请.txt",
  "合成实际交通服务申请 " + key(),
);
let cost = await call(p + "/costs", "POST", {
  category: "transport",
  reason: "合成实际现场交通",
  occurredAt: new Date().toISOString(),
  bearer: "代理公司",
  payee: "合成实际服务方",
  service: "实际现场交通服务",
  billingBasis: "实际凭证",
  budget: "80",
  requested: "50",
  evidenceVersionId: cproof.id,
  reviewed: true,
  idempotencyKey: key(),
});
cost = await call(p + `/accounts/${cost.id}/submit`, "POST", {
  expectedVersion: cost.version,
  reason: "实际预算和申请分开核对",
  idempotencyKey: key(),
});
await approve(cost.id);
await entry(cost.id, "incurred", "40", "incurred");
await entry(cost.id, "paid", "30", "paid");
w = await call(p);
assert.equal(w.summary.costBudget, "80.00");
assert.equal(w.summary.costRequested, "50.00");
assert.equal(w.summary.costApproved, "50.00");
assert.equal(w.summary.costActual, "40.00");
assert.equal(w.summary.costPaid, "30.00");
assert.equal(w.summary.costPayable, "10.00");
const after = await call(`/packages/${s.packageId}`);
assert.equal(after.record.version, before.record.version);
assert.equal(after.record.financialStatus, "unsettled");
pass(
  "Approved cost, budget, request, actual occurrence and payment remain separate; payable exact, fee updates do not invalidate frozen evaluation content version",
);
const waiver = await entry(a.id, "waiver", "5", "waiver");
assert.equal(waiver.status, "reviewing");
assert.equal((await call(p)).summary.waived, "0");
await approve(waiver.id);
assert.equal((await call(p)).summary.waived, "5.00");
pass(
  "Waiver is an independently approved financial adjustment, never an immediate silent reduction",
);
await fs.writeFile(
  ".p0/p4-finance-session.json",
  JSON.stringify({ ...s, receivableId: a.id, costId: cost.id }),
  { mode: 0o600 },
);
await fs.writeFile(
  ".p0/p4-finance-result.json",
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      scope:
        "Synthetic financial technical verification; no bank payment, real invoicing or collection",
    },
    null,
    2,
  ),
);
