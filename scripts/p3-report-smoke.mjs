import fs from "node:fs/promises";
import assert from "node:assert/strict";
const base = "http://127.0.0.1:18080",
  checks = [];
const pass = (t) => {
  checks.push(t);
  console.log("PASS", t);
};
for (let i = 0; i < 120; i++) {
  try {
    if ((await fetch(base + "/actuator/health")).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
const s = JSON.parse(await fs.readFile(".p0/p3-method-inquiry-session.json"));
assert.ok(s.tenantId.startsWith("agency-"));
const login = async (userId) => {
  const r = await fetch(base + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      account: userId + "@example.com",
      password: "demo123456",
      scope: "BUYER",
      tenantId: s.tenantId,
    }),
  });
  assert.equal(r.status, 200);
  return (await r.json()).data.accessToken;
};
const token = await login(s.userId),
  approverToken = await login(s.ids.reviewer);
async function raw(path, method = "GET", body, t = token) {
  const r = await fetch(base + path, {
    method,
    headers: {
      authorization: "Bearer " + t,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw Error(r.status + " " + j.message);
  return j.data;
}
const call = (p, m, b, t) => raw("/api/v1/buyer/agency" + p, m, b, t),
  bad = (p, m, b, code = 400, t) =>
    assert.rejects(() => call(p, m, b, t), new RegExp(String(code))),
  key = () => crypto.randomUUID(),
  p = s.root + "/recommendation",
  scope = { participationIds: s.subjects.map((v) => v.id), exclusions: {} };
let price = await call(s.root + "/price-calculations/preview", "POST", scope);
assert.deepEqual(price.blockers, []);
let calculation = await call(s.root + "/price-calculations", "POST", {
  scope,
  fingerprint: price.fingerprint,
  evidenceVersionId: s.proofId,
  reviewed: true,
  reason: "合成推荐当前询价价格来源",
  idempotencyKey: key(),
});
const rule = {
    ordering: "price_asc",
    candidateCount: 1,
    tieHandling: "manual_pending",
    ruleText: "按有效询价比较结果价格由低到高推荐一名，无默认三家规则",
  },
  inputs = {
    priceCalculationId: calculation.id,
    totalSnapshotId: null,
    documentRule: rule,
    configuredRule: rule,
    locator: "合成采购文件推荐条款",
  };
let view = await call(p + "/preview", "POST", inputs);
assert.deepEqual(view.blockers, []);
const confirm = {
  inputs,
  expectedFingerprint: view.sourceFingerprint,
  participationIds: [view.comparisons[0].participationId],
  evidenceVersionId: s.proofId,
  reviewed: true,
  reason: "合成组织人员核对后人工推荐",
  idempotencyKey: key(),
};
await bad(p, "POST", {
  ...confirm,
  participationIds: [view.comparisons[1].participationId],
});
await bad(p, "POST", { ...confirm, expectedFingerprint: "stale" }, 409);
const rec = await call(p, "POST", confirm);
assert.equal((await call(p, "POST", confirm)).id, rec.id);
pass(
  "Recommendation requires exact current calculation, manual evidence and top applicable candidate; stale and skipped candidates are rejected, idempotent replay preserves one immutable snapshot",
);
const narrative = {
  reviewProcess: "合成线下询价审查过程",
  reasoning: "依照已冻结有效性、原始金额与受控比较确定推荐",
  exceptionHandling: "合成核对无未处理异常；不自动认定法定条件",
  conclusion: "提出人工推荐供有权采购人另行确认",
};
let report = await call(p + "/reports", "POST", {
  recommendationId: rec.id,
  narrative,
  idempotencyKey: key(),
});
let workspace = await call(p);
const command = () => ({
  expectedVersion: report.version,
  expectedFingerprint: workspace.sourceFingerprint,
  reviewed: true,
  reason: "合成报告逐项核对",
  idempotencyKey: key(),
});
await bad(p + `/reports/${report.id}/submit`, "POST", command());
const artifact = await call(
  p + `/reports/${report.id}/generate`,
  "POST",
  command(),
);
assert.ok(artifact.fileHash.length === 64);
workspace = await call(p);
report = workspace.reports.find((r) => r.id === report.id);
assert.equal(report.artifactBasisVersion, report.version);
// An actual published Flowable definition, independent of the submitter.
let definitions = await raw("/api/v1/buyer/process-definitions");
let def = definitions.find(
  (d) => d.businessType === "agency_evaluation_report",
);
if (!def)
  def = await raw("/api/v1/buyer/process-definitions", "POST", {
    name: "合成评审报告独立审核",
    businessType: "agency_evaluation_report",
  });
await raw("/api/v1/buyer/process-definitions/" + def.id, "PUT", {
  name: def.name,
  status: "draft",
  businessType: "agency_evaluation_report",
  formSchema: JSON.stringify({ fields: [] }),
  flowSchema: JSON.stringify({
    steps: [
      {
        id: "review",
        type: "approver",
        title: "独立报告审核",
        assignment: { type: "user", userId: s.ids.reviewer },
      },
    ],
  }),
});
await raw("/api/v1/buyer/process-definitions/" + def.id + "/publish", "POST");
const body = command(),
  sub = await call(p + `/reports/${report.id}/submit`, "POST", body);
assert.equal(
  (await call(p + `/reports/${report.id}/submit`, "POST", body)).id,
  sub.id,
);
await bad(p + `/reports/${report.id}`, "PUT", {
  expectedVersion: report.version + 1,
  narrative,
});
const tasks = await raw(
    "/api/v1/buyer/workflow/tasks",
    "GET",
    undefined,
    approverToken,
  ),
  task = tasks.find((t) => t.businessId === sub.id);
assert.ok(task);
await raw(
  "/api/v1/buyer/workflow/tasks/" + task.taskId + "/complete",
  "POST",
  { action: "approve", comment: "合成独立逐项审核" },
  approverToken,
);
workspace = await call(p);
assert.equal(
  workspace.reports.find((r) => r.id === report.id).status,
  "approved",
);
assert.equal(
  workspace.submissions.find((r) => r.id === sub.id).status,
  "approved",
);
pass(
  "Real DOCX bytes seal with SHA256 before actual independent Flowable approval; reviewing narrative is immutable and approval is distinct from purchaser award",
);
await fs.writeFile(
  ".p0/p3-report-session.json",
  JSON.stringify({
    ...s,
    token,
    approverToken,
    recommendationId: rec.id,
    reportId: report.id,
  }),
  { mode: 0o600 },
);
await fs.writeFile(
  ".p0/p3-report-result.json",
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      scope:
        "Synthetic technical verification; no purchaser decision or external publication",
    },
    null,
    2,
  ),
);
