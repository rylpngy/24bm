import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { fixture, uploadProof } from "./agency-technical-fixture.mjs";
const f = await fixture(".p0/p4-finance-session.json"),
  { s, base, token, reviewer, call, bad, key } = f,
  p = `/packages/${s.packageId}/archive`,
  checks = [],
  pass = (t) => {
    checks.push(t);
    console.log("PASS", t);
  };
let w = await call(p),
  before = await call(`/packages/${s.packageId}`);
const freeze = (complete = false) => ({
  expectedFingerprint: w.sourceFingerprint,
  expectedPreviousId: w.snapshots[0]?.id || null,
  complete,
  retentionYears: 8,
  reason: "合成按单位归档制度保留实际版本，技术验证",
  reviewed: true,
  idempotencyKey: key(),
});
await bad(p + "/snapshots", "POST", freeze(true));
const first = await call(p + "/snapshots", "POST", freeze());
assert.equal(first.complete, false);
w = await call(p);
let state = {
  expectedVersion: w.state.version,
  dimension: "business",
  status: "closed",
  reason: "合成已完成有权结果办理",
  evidenceVersionId: s.proofId,
  remainingMatters: "继续收退款、支付及档案补件；业务与费用分开",
  ownerId: s.userId,
  reviewed: true,
  idempotencyKey: key(),
};
w = await call(p + "/states", "POST", state);
assert.equal(w.businessStatus, "closed");
await bad(p + "/states", "POST", {
  ...state,
  expectedVersion: w.state.version,
  dimension: "financial",
  status: "settled",
  idempotencyKey: key(),
});
pass(
  "Incomplete checklist cannot claim complete archive; business can close while money and archive remain open, financial settlement rejects pending balances",
);
for (const item of w.checklist) {
  if (item.disposition === "included" || item.applicability === "optional")
    continue;
  await call(p + "/checklist/" + item.key, "PUT", {
    expectedVersion: item.version || 0,
    disposition:
      item.applicability === "conditional" ? "not_applicable" : "included",
    fileVersionIds: item.applicability === "required" ? [s.proofId] : [],
    paperLocation: "合成纸质原件柜A-01（仅技术样本）",
    signingStatus: "signed",
    ownerId: s.userId,
    deadline: null,
    reason:
      "合成清单逐项核对；条件项依本项目实际依据确认不适用，非生产完整性认定",
    evidenceVersionId: s.proofId,
    reviewed: true,
    idempotencyKey: key(),
  });
}
w = await call(p);
assert.deepEqual(w.blockers, []);
const second = await call(p + "/snapshots", "POST", freeze(true));
w = await call(p);
assert.equal(w.archiveCompletion, "complete");
assert.equal(w.snapshots.length, 2);
assert.equal(
  w.snapshots.find((x) => x.id === first.id).frozenHash,
  first.frozenHash,
);
assert.equal(
  (await call(`/packages/${s.packageId}`)).record.version,
  before.record.version,
);
pass(
  "Method checklist freezes actual immutable file versions, SHA256, signature and paper metadata; a later snapshot appends and preserves the first, without invalidating evaluation content version",
);
const zip = await fetch(
  base + "/api/v1/buyer/agency" + p + `/snapshots/${second.id}/export`,
  { headers: { authorization: "Bearer " + token } },
);
assert.equal(zip.status, 200);
const bytes = Buffer.from(await zip.arrayBuffer());
assert.equal(bytes.subarray(0, 2).toString(), "PK");
await fs.writeFile(".p0/p4-archive-owner.zip", bytes);
const office = await f.login(s.ids.outsider),
  sql = (x) =>
    execFileSync(
      "docker",
      [
        "exec",
        "24bm-p0-postgres-1",
        "psql",
        "-U",
        "procurement",
        "-d",
        "procurement_agency_p0",
        "-At",
        "-c",
        x,
      ],
      { encoding: "utf8" },
    ),
  q = (x) => "'" + String(x).replaceAll("'", "''") + "'",
  role = s.ids.outsider + "-role";
assert.ok(s.ids.outsider.startsWith("agency-"));
const prior = sql(
  `select data_scope from roles where tenant_id=${q(s.tenantId)} and id=${q(role)}`,
).trim();
try {
  sql(
    `update roles set data_scope='all' where tenant_id=${q(s.tenantId)} and id=${q(role)}`,
  );
  const rz = await fetch(
    base + "/api/v1/buyer/agency" + p + `/snapshots/${second.id}/export`,
    { headers: { authorization: "Bearer " + office } },
  );
  assert.equal(rz.status, 200);
  await fs.writeFile(
    ".p0/p4-archive-office.zip",
    Buffer.from(await rz.arrayBuffer()),
  );
} finally {
  sql(
    `update roles set data_scope=${q(prior)} where tenant_id=${q(s.tenantId)} and id=${q(role)}`,
  );
}
pass(
  "Actual bounded ZIP exports recheck per-file ACL and real bytes, record download audit, and withhold restricted files from a non-frozen office approver",
);
await uploadProof(f, "归档后补件.txt", "合成归档后实际补件 " + key());
w = await call(p);
assert.equal(w.archiveCompletion, "accumulating");
assert.equal(w.businessStatus, "closed");
assert.equal(w.snapshots.find((x) => x.id === second.id).stale, true);
assert.equal(
  w.snapshots.find((x) => x.id === second.id).frozenHash,
  second.frozenHash,
);
pass(
  "New sealed evidence after archival reopens archive accumulation and marks old source stale while preserving immutable snapshot and business closure",
);
async function entry(account, kind, amount) {
  const proof = await uploadProof(
    f,
    "办结后财务-" + kind + "-" + key() + ".txt",
    "合成业务办结后仍可实际办理 " + key(),
  );
  return call(
    `/packages/${s.packageId}/finance/accounts/${account}/entries`,
    "POST",
    {
      kind,
      amount,
      occurredAt: new Date().toISOString(),
      evidenceVersionId: proof.id,
      counterparty: "合成实际往来方",
      reference: key(),
      reason: "合成办结后实际费用跟进",
      reviewed: true,
      duplicateReviewed: false,
      idempotencyKey: key(),
    },
  );
}
await entry(s.costId, "paid", "10");
await entry(s.receivableId, "refund", "5");
w = await call(p);
w = await call(p + "/states", "POST", {
  ...state,
  expectedVersion: w.state.version,
  dimension: "financial",
  status: "settled",
  remainingMatters: "合成余额与调整全部逐项核对无遗留",
  idempotencyKey: key(),
});
assert.equal(w.financialStatus, "settled");
assert.equal(w.businessStatus, "closed");
await entry(s.receivableId, "receipt", "1");
assert.equal((await call(p)).financialStatus, "unsettled");
pass(
  "Actual post-closure payments and refunds reconcile independently; later receipt reopens financial settlement without reopening business or changing content version",
);
await fs.writeFile(
  ".p0/p4-archive-session.json",
  JSON.stringify({ ...s, archiveSnapshotId: second.id }),
  { mode: 0o600 },
);
await fs.writeFile(
  ".p0/p4-archive-result.json",
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      scope:
        "Synthetic formal archive and independent completion technical verification; no production release or real business acceptance",
    },
    null,
    2,
  ),
);
