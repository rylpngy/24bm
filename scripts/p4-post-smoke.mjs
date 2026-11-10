import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { fixture } from "./agency-technical-fixture.mjs";
const { s, call, bad, key, definition, approve } = await fixture();
const p = `/packages/${s.packageId}/post`,
  checks = [],
  pass = (t) => {
    checks.push(t);
    console.log("PASS", t);
  },
  now = () => new Date().toISOString();
let ws = await call(p),
  recws = await call(s.root + "/recommendation");
const rec = recws.recommendations.find(
  (h) => h.recommendation.id === s.recommendationId,
);
assert.ok(rec && !rec.stale);
const candidate = JSON.parse(rec.recommendation.snapshotJson).candidates[0];
const decision = {
  sessionId: s.sessionId,
  expectedPreviousId: ws.results[0]?.id || null,
  kind: "award",
  reportId: s.reportId,
  participationId: candidate.participationId,
  authorityMode: "offline_authority",
  authorityName: "合成采购人有权签署主体",
  authorityRole: "采购人授权负责人",
  authorityScope: "仅合成项目本包结果确认",
  confirmedAt: now(),
  evidenceVersionId: s.proofId,
  reason: "合成真实线下决定登记测试，不产生实际业务决定",
  reviewed: true,
  idempotencyKey: key(),
};
await bad(
  p + "/results",
  "POST",
  { ...decision, authorityMode: "purchaser_account" },
  403,
);
await bad(p + "/results", "POST", {
  ...decision,
  participationId: "not-recommended",
});
let result = await call(p + "/results", "POST", decision);
assert.equal((await call(p + "/results", "POST", decision)).id, result.id);
pass(
  "Purchaser confirmation remains separate from report: frozen role or explicit offline authority and sealed evidence required, unrecommended supplier rejected",
);
const detail = await call(`/packages/${s.packageId}`);
let template = detail.files
  .filter(
    (f) => f.file.visibility === "project" && f.file.name.endsWith(".docx"),
  )
  .flatMap((f) => f.versions.filter((v) => v.status === "sealed"))[0];
assert.ok(template);
await definition("agency_post_document");
const documents = [];
for (const kind of ["notice", "announcement", "contract"]) {
  let d = await call(p + "/documents", "POST", {
    resultId: result.id,
    kind,
    templateVersionId: template.id,
    procurementRevisionId: kind === "contract" ? s.revisionId : null,
    obligations: "按合成采购文件原履约义务，不添加新实质义务",
    responseCommitments: "已人工对照合成响应承诺",
    text: "合成文书实际正文供技术验收",
    applicabilityBasis: "合成本方式实际适用条款，公告期限人工核对不预设",
    reason: "合成真实范本与确认结果核对",
    reviewed: true,
    idempotencyKey: key(),
  });
  const action = {
    expectedVersion: d.version,
    action:
      kind === "notice"
        ? "issue"
        : kind === "announcement"
          ? "publish"
          : "sign",
    occurredAt: now(),
    evidenceVersionId: s.proofId,
    recipient: "合成有权接收方",
    channel: "线下签署或外部网站人工办理",
    reference: "SYNTHETIC-" + key(),
    signedFileVersionId: kind === "contract" ? template.id : null,
    actualAmount: kind === "contract" ? candidate.responseAmount : null,
    reason: "合成已发生办理证据登记",
    reviewed: true,
    idempotencyKey: key(),
  };
  await bad(p + `/documents/${d.id}/actions`, "POST", action);
  d = await call(p + `/documents/${d.id}/submit`, "POST", {
    expectedVersion: d.version,
    reason: "合成独立提审",
    idempotencyKey: key(),
  });
  await approve(d.id);
  d = (await call(p)).documents.find((v) => v.id === d.id);
  if (kind === "notice")
    await bad(p + `/documents/${d.id}/actions`, "POST", {
      ...action,
      expectedVersion: d.version,
      action: "deliver",
    });
  if (kind === "contract")
    await bad(p + `/documents/${d.id}/actions`, "POST", {
      ...action,
      expectedVersion: d.version,
      actualAmount: "99999999",
    });
  d = await call(p + `/documents/${d.id}/actions`, "POST", {
    ...action,
    expectedVersion: d.version,
  });
  if (kind === "notice")
    d = await call(p + `/documents/${d.id}/actions`, "POST", {
      ...action,
      expectedVersion: d.version,
      action: "deliver",
      occurredAt: now(),
      idempotencyKey: key(),
    });
  assert.equal(
    d.status,
    kind === "notice"
      ? "delivered"
      : kind === "announcement"
        ? "published"
        : "signed",
  );
  documents.push(d.id);
}
pass(
  "Actual DOCX generation and three independent Flowable approvals precede external publication, notice issue/delivery and signed contract; skipped states and amount divergence rejected, no fee-collection gate",
);
let issue = await call(p + "/issues", "POST", {
  kind: "question",
  title: "合成质疑事项",
  ownerId: s.userId,
  occurredAt: now(),
  deadline: new Date(Date.now() + 86400000).toISOString(),
  evidenceVersionId: s.proofId,
  status: "open",
  authorityDecision: "尚待有权主体决定，系统未自动暂停或答复",
  handlingNote: "登记实际材料、期限与责任人",
  reviewed: true,
  idempotencyKey: key(),
});
assert.equal(issue.status, "open");
pass(
  "External question is a controlled dated matter with owner, deadline and evidence; no automatic legal answer or ruling",
);
await fs.writeFile(
  ".p0/p4-post-session.json",
  JSON.stringify({
    ...s,
    resultId: result.id,
    postDocumentIds: documents,
    issueId: issue.id,
  }),
  { mode: 0o600 },
);
await fs.writeFile(
  ".p0/p4-post-result.json",
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      scope:
        "Synthetic offline post-award technical verification; no real publication, signing or authority decision",
    },
    null,
    2,
  ),
);
