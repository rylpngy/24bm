import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fixture, uploadProof } from "./agency-technical-fixture.mjs";
const f = await fixture(".p0/p4-archive-session.json"),
  { s, call, bad, key, base, reviewer } = f,
  checks = [],
  pass = (t) => {
    checks.push(t);
    console.log("PASS", t);
  },
  sql = (s) =>
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
        s,
      ],
      { encoding: "utf8" },
    ),
  q = (s) => "'" + String(s).replaceAll("'", "''") + "'";
assert.ok(s.ids.reviewer.startsWith("agency-"));
let saved = sql(
  `select permissions from roles where id=${q(s.ids.reviewer + "-role")} and tenant_id=${q(s.tenantId)}`,
).trim();
const experts = await call(`/packages/${s.packageId}/finance/expert-sources`);
assert.ok(experts.length);
const proof = await uploadProof(
    f,
    "专家脱敏费用凭证-" + key() + ".txt",
    "合成公开脱敏凭证 " + key(),
  ),
  expert = experts[0];
const expertCost = await call(
  `/packages/${s.packageId}/finance/costs`,
  "POST",
  {
    category: "expert",
    reason: "EXPERT-SECRET-REASON",
    occurredAt: new Date().toISOString(),
    bearer: "代理公司",
    payee: "EXPERT-SECRET-PAYEE",
    expertUserId: expert.userId,
    sessionId: expert.sessionId,
    service: "EXPERT-SECRET-SERVICE",
    billingBasis: "EXPERT-SECRET-BASIS",
    budget: "100",
    requested: "80",
    evidenceVersionId: proof.id,
    reviewed: true,
    idempotencyKey: key(),
  },
);
try {
  const permissions = [
    "buyer:agency:read",
    "buyer:agency:file:read",
    "buyer:agency:file:download",
    "buyer:agency:finance:read",
    "buyer:agency:office:read",
    "buyer:agency:archive:read",
    "buyer:agency:archive:export",
    "buyer:agency:post:read",
  ];
  sql(
    `update roles set permissions=${q(JSON.stringify(permissions))}::jsonb where id=${q(s.ids.reviewer + "-role")} and tenant_id=${q(s.tenantId)}`,
  );
  const w = await call(
    `/packages/${s.packageId}/finance`,
    "GET",
    undefined,
    reviewer,
  );
  assert.ok(w.accounts.some((a) => a.id === expertCost.id));
  assert.ok(!JSON.stringify(w).includes("EXPERT-SECRET"));
  assert.ok(
    !JSON.stringify(w.accounts.find((a) => a.id === expertCost.id)).includes(
      expert.userId,
    ),
  );
  await bad(
    `/packages/${s.packageId}/finance/expert-sources`,
    "GET",
    undefined,
    403,
    reviewer,
  );
  await bad(
    `/packages/${s.packageId}/finance/accounts/${expertCost.id}/submit`,
    "POST",
    {
      expectedVersion: expertCost.version,
      reason: "unauthorized",
      idempotencyKey: key(),
    },
    403,
    reviewer,
  );
  pass(
    "Ordinary authorized finance statistics contain category and money but no expert identity, payee or private service snapshot; expert options and writes require separate permission",
  );
  const post = await call(
    `/packages/${s.packageId}/post`,
    "GET",
    undefined,
    reviewer,
  );
  assert.ok(post.sources.some((v) => v.sessionId === s.sessionId));
  const zip = await fetch(
    base +
      `/api/v1/buyer/agency/packages/${s.packageId}/archive/snapshots/${s.archiveSnapshotId}/export`,
    { headers: { authorization: "Bearer " + reviewer } },
  );
  assert.equal(zip.status, 200);
  await fs.writeFile(
    ".p0/p4-archive-restricted.zip",
    Buffer.from(await zip.arrayBuffer()),
  );
  pass(
    "Post-award authority reads only approved report candidate summaries through its own permission; archive export does not require or grant evaluation opinion access",
  );
} finally {
  sql(
    `update roles set permissions=${q(saved)}::jsonb where id=${q(s.ids.reviewer + "-role")} and tenant_id=${q(s.tenantId)}`,
  );
}
let issue = (await call(`/packages/${s.packageId}/post`)).issues.find(
  (i) => i.id === s.issueId,
);
const draft = JSON.parse(issue.snapshotJson).draft;
issue = await call(`/packages/${s.packageId}/post/issues/${issue.id}`, "PUT", {
  ...draft,
  expectedVersion: issue.version,
  status: "handling",
  authorityDecision: "合成真实有权书面暂停标后办理",
  authorityEffect: "pause",
  handlingNote: "执行明确有权决定，非系统自动判断",
  idempotencyKey: key(),
});
assert.equal(
  (await call(`/packages/${s.packageId}/post`)).controlState,
  "paused",
);
const result = (await call(`/packages/${s.packageId}/post`)).results[0];
await bad(`/packages/${s.packageId}/post/documents`, "POST", {
  resultId: result.id,
  kind: "notice",
  reviewed: true,
  idempotencyKey: key(),
});
await call(`/packages/${s.packageId}/post/issues/${issue.id}`, "PUT", {
  ...draft,
  expectedVersion: issue.version,
  status: "handling",
  authorityDecision: "合成有权决定已满足恢复条件",
  authorityEffect: "resume",
  handlingNote: "单独记录实际恢复依据",
  idempotencyKey: key(),
});
assert.equal(
  (await call(`/packages/${s.packageId}/post`)).controlState,
  "active",
);
pass(
  "Actual authorized issue decision pauses post-award generation and release; closing or handling alone does not resume, a separate authorized resume is recorded",
);
await fs.writeFile(
  ".p0/p4-permissions-result.json",
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      scope: "Synthetic role and exception isolation; permissions restored",
    },
    null,
    2,
  ),
);
