import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const s = JSON.parse(
  await fs.readFile(".p0/p3-final-response-browser-session.json"),
);
assert.ok(s.tenantId.startsWith("agency-assessment-"));
const [editor, viewer] = s.reviewers,
  base = "http://127.0.0.1:18080",
  checks = [],
  pass = (t) => {
    checks.push(t);
    console.log("PASS", t);
  };
for (let i = 0; i < 120; i++) {
  try {
    if ((await fetch(base + "/actuator/health")).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
async function refresh(u) {
  const r = await fetch(base + "/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      account: u.userId + "@example.com",
      password: "demo123456",
      scope: "BUYER",
      tenantId: u.tenantId,
    }),
  });
  assert.equal(r.status, 200);
  u.token = (await r.json()).data.accessToken;
}
for (const u of [s, editor, viewer]) await refresh(u);
async function raw(path, method = "GET", body, u = s) {
  const r = await fetch(base + path, {
    method,
    headers: {
      authorization: "Bearer " + u.token,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  const j = text ? JSON.parse(text) : {};
  if (!r.ok) throw Error("failed: " + r.status + " " + j.message);
  return j.data;
}
const call = (p, m = "GET", b, u = s) =>
    raw("/api/v1/buyer/agency" + p, m, b, u),
  bad = (p, m, b, status = 400, u = s) =>
    assert.rejects(() => call(p, m, b, u), new RegExp("failed: " + status));
const p = s.root + "/final-response-review",
  f = { root: s.root },
  [a, b] = s.suppliers.map((v) => v.id),
  scope = { participationIds: [a, b], exclusions: {} };
const pr = {
  priceSource: "final_original",
  formula: "minimum_ratio",
  criterionKey: "P1",
  fullScore: "30",
  scale: 2,
  rounding: "HALF_UP",
  tieRule: "按合成定稿另行处理同价，不排序",
};
async function price(f, freezeRule = true) {
  const p = f.root + "/price-calculations";
  if (freezeRule) {
    let r = await call(p + "/rule", "PUT", {
      expectedVersion: 0,
      config: {
        ruleVersion: "TOTAL-PRICE-V1",
        basis: "合成客观价格分依据",
        locator: "合成价格P1",
        documentRule: pr,
        configuredRule: pr,
      },
      reason: "合成价格规则核对",
      idempotencyKey: crypto.randomUUID(),
    });
    await call(p + "/rule/freeze", "POST", {
      expectedVersion: r.version,
      reviewed: true,
      reason: "已核对合成价格权重和舍入",
      idempotencyKey: crypto.randomUUID(),
    });
  }
  const preview = await call(p + "/preview", "POST", scope);
  assert.deepEqual(preview.blockers, []);
  return call(p, "POST", {
    scope,
    fingerprint: preview.fingerprint,
    evidenceVersionId: s.proofId,
    reviewed: true,
    reason: "合成价格范围及全部明细复核",
    idempotencyKey: crypto.randomUUID(),
  });
}
let original = await call(p + "/mine", "GET", undefined, editor);
assert.equal(original.sheet.status, "submitted");
const originalJson = original.sheet.entriesJson,
  originalHash = original.sheet.frozenHash,
  baseHistory = original.history.length;
const priceWorkspace = await call(f.root + "/price-calculations");
const oldPrice = await price(f, priceWorkspace.rule === null);
const body = () => ({
  expectedVersion: original.sheet.version,
  expectedFingerprint: original.fingerprint,
  cells: [{ participationId: a, criterionKey: "T1" }],
  reason: "合成核对最终响应页码后申请本对象技术项更正",
  evidenceVersionId: s.proofId,
  formData: {},
  idempotencyKey: crypto.randomUUID(),
});
await bad(p + "/corrections", "POST", body(), 403, s);
await bad(
  p + "/corrections",
  "POST",
  { ...body(), cells: [{ participationId: "foreign", criterionKey: "T1" }] },
  400,
  editor,
);
await bad(
  p + "/corrections",
  "POST",
  { ...body(), expectedFingerprint: "stale" },
  409,
  editor,
);
let definitions = await raw("/api/v1/buyer/process-definitions");
let def = definitions.find(
  (v) => v.businessType === "agency_assessment_correction",
);
async function definition(approver) {
  if (!def)
    def = await raw("/api/v1/buyer/process-definitions", "POST", {
      name: "最终响应限定更正",
      businessType: "agency_assessment_correction",
    });
  await raw("/api/v1/buyer/process-definitions/" + def.id, "PUT", {
    name: def.name,
    status: "draft",
    businessType: "agency_assessment_correction",
    formSchema: JSON.stringify({ fields: [] }),
    flowSchema: JSON.stringify({
      steps: [
        {
          id: "review",
          type: "approver",
          title: "独立限定授权",
          assignment: { type: "user", userId: approver },
        },
      ],
    }),
  });
  await raw("/api/v1/buyer/process-definitions/" + def.id + "/publish", "POST");
}
await definition(s.userId);
let requestBody = body(),
  request = await call(p + "/corrections", "POST", requestBody, editor);
assert.equal(
  (await call(p + "/corrections", "POST", requestBody, editor)).id,
  request.id,
);
assert.equal(request.status, "processing");
await bad(p + "/corrections", "POST", body(), 400, editor);
assert.equal(
  (await call(p + "/mine", "GET", undefined, editor)).sheet.frozenHash,
  originalHash,
);
let prices = await call(f.root + "/price-calculations");
assert.ok(prices.blockers.some((v) => v.includes("待审最终响应更正")));
assert.equal(
  prices.history.find((v) => v.calculation.id === oldPrice.id).stale,
  true,
);
const wf = await raw(
  "/api/v1/buyer/workflow/instances/" + request.workflowId + "/history",
  "GET",
  undefined,
  editor,
);
assert.ok(!JSON.stringify(wf).includes("BROWSER-EDITOR-PRIVATE-FINAL"));
pass(
  "A real independent Flowable request freezes exact original hash and permitted cells; drafts stay locked, private opinions stay out of the workflow snapshot, and pending correction blocks old price use",
);
async function decide(request, action = "approve") {
  const tasks = await raw("/api/v1/buyer/workflow/tasks");
  const task = tasks.find((v) => v.businessId === request.id);
  assert.ok(task);
  return raw(
    "/api/v1/buyer/workflow/tasks/" + task.taskId + "/complete",
    "POST",
    { action, comment: "合成最终响应限定更正 " + action },
  );
}
await decide(request);
let mine = await call(p + "/mine", "GET", undefined, editor);
assert.equal(mine.history.length, baseHistory + 1);
assert.equal(mine.sheet.status, "draft");
assert.equal(mine.sheet.previousId, original.sheet.id);
assert.equal(
  mine.history.find((v) => v.id === original.sheet.id).entriesJson,
  originalJson,
);
assert.equal(
  mine.history.find((v) => v.id === original.sheet.id).frozenHash,
  originalHash,
);
const values = JSON.parse(mine.sheet.entriesJson),
  save = (entries, patch = {}) => ({
    expectedVersion: mine.sheet.version,
    expectedFingerprint: mine.fingerprint,
    entries,
    idempotencyKey: crypto.randomUUID(),
    ...patch,
  });
await bad(
  p + "/mine",
  "PUT",
  save(
    values.map((v) =>
      v.participationId === b && v.criterionKey === "T1"
        ? { ...v, score: "9" }
        : v,
    ),
  ),
  400,
  editor,
);
await bad(
  p + "/mine",
  "PUT",
  save(values, { expectedFingerprint: original.fingerprint }),
  409,
  editor,
);
const changed = values.map((v) =>
  v.participationId === a && v.criterionKey === "T1"
    ? { ...v, score: "5", opinion: "PRIVATE-FINAL-CORRECTED" }
    : v,
);
await call(p + "/mine", "PUT", save(changed), editor);
mine = await call(p + "/mine", "GET", undefined, editor);
await call(
  p + "/mine/submit",
  "POST",
  {
    expectedVersion: mine.sheet.version,
    expectedFingerprint: mine.fingerprint,
    evidenceVersionId: s.proofId,
    personallyConfirmed: true,
    idempotencyKey: crypto.randomUUID(),
  },
  editor,
);
mine = await call(p + "/mine", "GET", undefined, editor);
assert.equal(mine.sheet.status, "submitted");
assert.notEqual(mine.sheet.frozenHash, originalHash);
assert.equal(
  mine.history.find((v) => v.id === original.sheet.id).entriesJson,
  originalJson,
);
assert.ok(
  !JSON.stringify(await call(p + "/mine", "GET", undefined, viewer)).includes(
    "PRIVATE-FINAL-CORRECTED",
  ),
);
prices = await call(f.root + "/price-calculations");
assert.equal(
  prices.history.find((v) => v.calculation.id === oldPrice.id).stale,
  true,
);
const newPrice = await price(f, false);
assert.notEqual(newPrice.id, oldPrice.id);
pass(
  "Approval appends the owner’s next draft, scope checks reject other cells and old basis acknowledgments, and resubmission preserves old bytes while requiring a new price review",
);
original = mine;
let rejected = await call(p + "/corrections", "POST", body(), editor);
await decide(rejected, "reject");
assert.equal(
  (await call(p + "/mine", "GET", undefined, editor)).sheet.id,
  mine.sheet.id,
);
const withdrawn = await call(p + "/corrections", "POST", body(), editor);
await bad(
  p + "/corrections/" + withdrawn.id + "/withdraw",
  "POST",
  { reason: "他人不能撤回" },
  403,
  s,
);
await call(
  p + "/corrections/" + withdrawn.id + "/withdraw",
  "POST",
  { reason: "本人撤回合成申请" },
  editor,
);
assert.equal(
  (await call(p + "/mine", "GET", undefined, editor)).corrections.find(
    (v) => v.id === withdrawn.id,
  ).status,
  "withdrawn",
);
pass(
  "Rejection and personal withdrawal retain the submitted version; another user cannot withdraw or replace the owner’s opinion",
);
await definition(editor.userId);
const self = await call(p + "/corrections", "POST", body(), editor);
assert.match(self.workflowId, /^[A-Za-z0-9-]+$/);
const task = execFileSync(
  "docker",
  [
    "exec",
    "24bm-p0-postgres-1",
    "psql",
    "-U",
    "procurement",
    "-d",
    "procurement_agency_p0",
    "-Atc",
    `select id_ from act_ru_task where proc_inst_id_=(select flowable_process_instance_id from workflow_business_instances where id='${self.workflowId}');`,
  ],
  { encoding: "utf8" },
).trim();
assert.ok(task);
await assert.rejects(
  () =>
    raw(
      "/api/v1/buyer/workflow/tasks/" + task + "/complete",
      "POST",
      { action: "approve", comment: "不得自审" },
      editor,
    ),
  /failed: 403/,
);
await call(
  p + "/corrections/" + self.id + "/withdraw",
  "POST",
  { reason: "本人撤回自审阻断合成申请" },
  editor,
);
await definition(s.userId);
pass(
  "Even a wildcard reviewer named as approver cannot approve their own correction; real Flowable task guards enforce separation",
);
await fs.writeFile(
  ".p0/p3-final-correction-session.json",
  JSON.stringify({ ...s, reviewers: [editor, viewer] }),
  { mode: 0o600 },
);
await fs.writeFile(
  ".p0/p3-final-correction-smoke-result.json",
  JSON.stringify({ passed: checks.length, checks }, null, 2),
);
console.log("Final correction passed:", checks.length);
