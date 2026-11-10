import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { fixture } from "./agency-technical-fixture.mjs";
const { s, raw, call, key, reviewer } = await fixture(
    ".p0/p3-method-invitation-session.json",
  ),
  p = s.root + "/recommendation",
  w = await call(p),
  rec = w.recommendations.find((r) => !r.stale);
assert.ok(rec);
let report = await call(p + "/reports", "POST", {
  recommendationId: rec.recommendation.id,
  narrative: {
    reviewProcess: "甲实际编制过程",
    reasoning: "甲编制推荐理由",
    exceptionHandling: "甲实际核对异常",
    conclusion: "甲编制报告，不替代有权确认",
  },
  idempotencyKey: key(),
});
const cmd = {
  expectedVersion: report.version,
  expectedFingerprint: w.sourceFingerprint,
  reviewed: true,
  reason: "合成不同发起人与编制人的独立性核验",
  idempotencyKey: key(),
};
await call(p + `/reports/${report.id}/generate`, "POST", cmd);
const def = (await raw("/api/v1/buyer/process-definitions")).find(
  (d) => d.businessType === "agency_evaluation_report",
);
assert.ok(def);
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
        title: "编制人与代提审人分离验证",
        assignment: { type: "user", userId: s.userId },
      },
    ],
  }),
});
await raw("/api/v1/buyer/process-definitions/" + def.id + "/publish", "POST");
const sub = await call(
    p + `/reports/${report.id}/submit`,
    "POST",
    { ...cmd, idempotencyKey: key() },
    reviewer,
  ),
  noop = null;
const sql = (text) =>
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
        text,
      ],
      { encoding: "utf8" },
    ),
  q = (x) => "'" + String(x).replaceAll("'", "''") + "'",
  role = s.userId + "-role";
assert.ok(s.userId.startsWith("agency-"));
const prior = sql(
  `select data_scope from roles where tenant_id=${q(s.tenantId)} and id=${q(role)}`,
).trim();
try {
  sql(
    `update roles set data_scope='all' where tenant_id=${q(s.tenantId)} and id=${q(role)}`,
  );
  const tasks = await raw("/api/v1/buyer/workflow/tasks"),
    task = tasks.find((t) => t.businessId === sub.id);
  assert.ok(task);
  await assert.rejects(
    () =>
      raw("/api/v1/buyer/workflow/tasks/" + task.taskId + "/complete", "POST", {
        action: "approve",
        comment: "报告编制人不能通过其他人代提审后自批",
      }),
    /403.*不得自行审核报告/,
  );
} finally {
  sql(
    `update roles set data_scope=${q(prior)} where tenant_id=${q(s.tenantId)} and id=${q(role)}`,
  );
}
await call(
  p + `/submissions/${sub.id}/withdraw`,
  "POST",
  { reason: "合成已验证独立审核限制，由实际提审人撤回" },
  reviewer,
);
assert.equal(
  (await call(p)).submissions.find((v) => v.id === sub.id).status,
  "withdrawn",
);
const checks = [
  "Report compiler cannot approve their own report after a different frozen organizer submits it; actual Flowable task rejects the compiler and the real initiator can withdraw",
];
console.log("PASS", checks[0]);
await fs.writeFile(
  ".p0/p5-report-independence-result.json",
  JSON.stringify({ passed: checks.length, checks }, null, 2),
);
