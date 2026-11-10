import { createHash } from "node:crypto";
import { prepareSupplierDiscussions } from "./agency-discussion-support.mjs";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {
  prepareMaterialOpening,
  uploadReceiptVersion,
} from "./agency-material-opening-support.mjs";
const s = JSON.parse(await fs.readFile(".p0/p3-price-browser-session.json")),
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
  assert.equal(r.status, 200, "Synthetic login failed");
  const j = await r.json();
  u.token = (j.data || j).accessToken;
  assert.equal(typeof u.token, "string");
}
await refresh(s);
await refresh(editor);
const detail = await call("/packages/" + pkg);
assert.equal(detail.record.procurementMethod, "竞争性磋商");
const viewer = {
  userId: detail.members.find((m) => m.role === "VIEWER").userId,
  tenantId: s.tenantId,
};
await refresh(viewer);
for (const name of await fs.readdir(".p0"))
  if (name.includes("session") && name.endsWith(".json")) {
    try {
      const file = ".p0/" + name;
      const stored = JSON.parse(await fs.readFile(file));
      const u = [s, editor, viewer].find(
        (u) => u.userId === stored.userId && u.tenantId === stored.tenantId,
      );
      if (u && stored.token) {
        stored.token = u.token;
        await fs.writeFile(file, JSON.stringify(stored), { mode: 0o600 });
      }
    } catch {}
  }
const all = await call("/evaluation/packages/" + pkg + "/rounds"),
  template = all.rounds.find((r) => r.round.id === s.roundId);
assert.ok(template);
const [a, b] = s.suppliers.map((v) => v.id),
  scope = { participationIds: [a, b], exclusions: {} };
async function make(title) {
  const cfg = {
    ...template.config,
    title: title + " " + Date.now(),
    members: [
      { userId: s.userId, roles: ["organizer"] },
      { userId: editor.userId, roles: ["review_member"] },
      { userId: viewer.userId, roles: ["review_member"] },
    ],
  };
  let r = await call("/evaluation/packages/" + pkg + "/rounds", "POST", {
    expectedVersion: 0,
    config: cfg,
    reason: "汇总合成技术验证，独立轮次",
    idempotencyKey: crypto.randomUUID(),
  });
  r = await call(
    "/evaluation/packages/" + pkg + "/rounds/" + r.round.id + "/freeze",
    "POST",
    {
      expectedVersion: r.round.version,
      businessRulesReviewed: true,
      reason: "核对合成70/30及两名成员职责",
      idempotencyKey: crypto.randomUUID(),
    },
  );
  const opened = await prepareMaterialOpening({
    call,
    headers,
    pkg,
    round: r.round.id,
    participantIds: [a, b],
    proofId: s.proofId,
    clock: Date.now() - 7200000,
  });
  const session = await call(
    "/evaluation/packages/" + pkg + "/rounds/" + r.round.id + "/assessment",
    "POST",
    {
      expectedRoundVersion: r.round.version,
      participationIds: [a, b],
      openingEvidenceVersionId: s.proofId,
      openedAt: opened.opening.openedAt,
      openingReviewed: true,
      note: "合成受控汇总技术验收",
      idempotencyKey: crypto.randomUUID(),
    },
  );
  return {
    roundId: r.round.id,
    sessionId: session.id,
    root: "/evaluation/packages/" + pkg + "/sessions/" + session.id,
  };
}
async function submit(f, u, technical, manualPrice) {
  const p = f.root + "/mine?stage=evaluation";
  let m = await call(p, "GET", undefined, u.token);
  const entries = s.suppliers.flatMap((v, i) =>
    ["T1", "P1"].map((key) => ({
      participationId: v.id,
      criterionKey: key,
      score: key === "T1" ? technical[i] : manualPrice[i],
      conclusion: null,
      evidence: "合成材料页码",
      opinion: "PRIVATE-TOTAL-OPINION-" + u.userId,
    })),
  );
  await call(
    p,
    "PUT",
    {
      expectedVersion: m.sheets[0].version,
      entries,
      idempotencyKey: crypto.randomUUID(),
    },
    u.token,
  );
  m = await call(p, "GET", undefined, u.token);
  await call(
    f.root + "/mine/submit?stage=evaluation",
    "POST",
    {
      expectedVersion: m.sheets[0].version,
      personallyConfirmed: true,
      idempotencyKey: crypto.randomUUID(),
    },
    u.token,
  );
}
async function final(f, values) {
  const discussionFingerprint = await prepareSupplierDiscussions({
    call,
    root: f.root,
    proofId: s.proofId,
    participantIds: [a, b],
  });
  const p = f.root + "/final-quotes",
    now = Date.now();
  await call(p, "POST", {
    discussionFingerprint,
    participationIds: [a, b],
    exclusions: {},
    initiatedAt: new Date(now - 3600000).toISOString(),
    cutoffAt: new Date(now - 60000).toISOString(),
    requirementsVersionId: s.proofId,
    noticeVersionId: s.proofId,
    reviewed: true,
    reason: "合成最终需求和最后报价发起通知核对",
    idempotencyKey: crypto.randomUUID(),
  });
  const decisions = [];
  for (const [i, id] of [a, b].entries()) {
    const row = await call(p + "/receipts", "POST", {
      participationId: id,
      fileName: "汇总最终响应合成.txt",
      amount: values[i],
      currency: "CNY",
      receivedAt: new Date(now - 120000).toISOString(),
      originalType: "electronic_copy",
      sourceNote: "合成最终响应及最后报价副本，不代表供应商身份",
      lateEntryReason: "已人工核对真实接收时点的合成补录",
      idempotencyKey: crypto.randomUUID(),
    });
    await uploadReceiptVersion(
      row.file.versions[0].id,
      "汇总最终响应合成.txt",
      "合成最后报价 " + values[i],
      headers,
    );
    decisions.push({
      participationId: id,
      receiptId: row.receipt.id,
      status: "accepted",
      reason: "已核对合成按时接收最终响应及报价",
    });
  }
  const w = await call(p);
  await call(p + "/confirm", "POST", {
    expectedVersion: w.campaign.version,
    receiptFingerprint: w.receiptFingerprint,
    decisions,
    evidenceVersionId: s.proofId,
    reviewed: true,
    note: "合成最终报价逐家核对",
    idempotencyKey: crypto.randomUUID(),
  });
}
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
const rule = (patch = {}) => ({
  method: "mean_raw_then_weight",
  totalScale: 2,
  totalRounding: "HALF_UP",
  tieHandling: "manual_pending",
  sources: [
    { criterionKey: "T1", source: "member_mean" },
    { criterionKey: "P1", source: "objective_price" },
  ],
  ...patch,
});
const cfg = (a = rule(), b = rule()) => ({
  ruleVersion: "TOTAL-V1",
  basis: "合成定稿汇总规则，非实际业务适用认定",
  locator: "合成汇总与最终舍入章节",
  documentRule: a,
  configuredRule: b,
});
const save = (config, v = 0) => ({
  expectedVersion: v,
  config,
  reason: "合成逐项来源及舍入核对",
  idempotencyKey: crypto.randomUUID(),
});
const freeze = (r) => ({
  expectedVersion: r.version,
  reviewed: true,
  reason: "原文、全部冻结成员、唯一来源和舍入顺序已核对",
  idempotencyKey: crypto.randomUUID(),
});
const confirm = (p, id) => ({
  priceCalculationId: id,
  fingerprint: p.fingerprint,
  evidenceVersionId: s.proofId,
  reviewed: true,
  reason: "人工复核合成成员版本、唯一来源和汇总；不形成排名或推荐",
  idempotencyKey: crypto.randomUUID(),
});
async function recordCommonChange(f) {
  await prepareSupplierDiscussions({
    call,
    root: f.root,
    proofId: s.proofId,
    participantIds: [a, b],
  });
  const d = f.root + "/discussions",
    dw = await call(d),
    at = (m) => new Date(Date.parse(dw.openedAt) + m * 60000).toISOString();
  const draft = await call(d + "/" + a + "/draft", "PUT", {
    recordId: null,
    expectedVersion: 0,
    content: {
      startedAt: at(5),
      endedAt: at(10),
      staffUserIds: [s.userId],
      supplierAttendees: "合成线下代表",
      agenda: "合成共同交付内容调整",
      discussion: "PRIVATE-FINAL-DEMAND-DISCUSSION",
      supplierResponse: "合成仅本对象回应",
      conclusion: "待有权确认及通知",
      changeDisposition: "requires_authorized_change",
      changeNote: "待登记外部确认和全部对象通知",
      evidenceVersionId: s.proofId,
    },
    reason: "合成共同需求调整来源",
    idempotencyKey: crypto.randomUUID(),
  });
  await call(d + "/" + a + "/" + draft.id + "/confirm", "POST", {
    expectedVersion: draft.version,
    expectedPreviousId: draft.previousId,
    expectedFingerprint: (await call(d)).fingerprint,
    supplierConfirmationVersionId: s.proofId,
    supplierConfirmationNote: "合成线下核对，不是电子签署",
    reviewed: true,
    idempotencyKey: crypto.randomUUID(),
  });
  const p = f.root + "/requirement-changes";
  const change = await call(p, "POST", {
    expectedFingerprint: (await call(p)).fingerprint,
    kind: "technical",
    locator: "共同交付条款第3项",
    beforeText: "仅提交PDF报告",
    afterText: "另附可编辑交付副本；资格条件及评分标准不变",
    authorityName: "合成采购人代表",
    authorityRole: "授权代表",
    authorityScope: "合成书面授权范围及确认凭证",
    authorizationVersionId: s.proofId,
    authorizedAt: at(20),
    requirementsVersionId: s.proofId,
    noticeVersionId: s.proofId,
    sentAt: at(25),
    channel: "合成同一线下批次",
    responseDeadlineAt: at(40),
    limitsReviewed: true,
    publicContentReviewed: true,
    adequateTimeReviewed: true,
    reason: "合成外部授权和统一通知，非实际业务依据",
    idempotencyKey: crypto.randomUUID(),
  });
  for (const id of [a, b])
    await call(p + "/" + change.id + "/receipts", "POST", {
      expectedFingerprint: (await call(p)).fingerprint,
      participationId: id,
      expectedPreviousId: null,
      receivedAt: at(30),
      recipient: "合成接收代表",
      evidenceVersionId: s.proofId,
      note: "核对同一冻结需求及通知",
      contentChecked: true,
      idempotencyKey: crypto.randomUUID(),
    });
  await call(p + "/" + change.id + "/complete", "POST", {
    expectedFingerprint: (await call(p)).fingerprint,
    reviewed: true,
    evidenceVersionId: s.proofId,
    note: "合成全部通知核对",
    idempotencyKey: crypto.randomUUID(),
  });
}

const f = await make("最终响应独立复核接口验收"),
  p = f.root + "/final-response-review";
await submit(f, editor, ["8", "8"], ["100", "0"]);
await submit(f, viewer, ["6", "4"], ["0", "100"]);
await recordCommonChange(f);
await final(f, ["100.00", "300.00"]);
let w = await call(p);
assert.equal(w.mode, "required");
assert.equal(w.branch.finalResponseRequired, true);
const fq = await call(f.root + "/final-quotes"),
  accepted = JSON.parse(fq.campaign.decisionsJson);
const details = await call("/packages/" + pkg),
  version = details.files
    .flatMap((x) => x.versions)
    .find((v) => v.id === accepted[0].fileVersionId);
async function download(id, token) {
  return fetch(base + "/api/v1/buyer/attachments/" + id + "/download", {
    headers: { authorization: "Bearer " + token },
  });
}
assert.equal((await download(version.attachmentId, editor.token)).status, 403);
await bad(p + "/mine", "GET", undefined, 400);
await bad(
  "/evaluation/packages/foreign/sessions/" +
    f.sessionId +
    "/final-response-review",
  "GET",
  undefined,
  403,
);
let preview = await call(f.root + "/price-calculations/preview", "POST", scope);
assert.ok(preview.blockers.some((v) => v.includes("最终响应")));
const activation = () => ({
  expectedVersion: w.plan?.version || 0,
  expectedFingerprint: w.fingerprint,
  evidenceVersionId: s.proofId,
  reviewed: true,
  reason: "合成实际最终需求、全部成员及最终响应版本核对，原评分标准不变",
  idempotencyKey: crypto.randomUUID(),
});
await bad(p + "/activate", "POST", { ...activation(), reviewed: false });
await bad(
  p + "/activate",
  "POST",
  { ...activation(), expectedFingerprint: "stale" },
  409,
);
await bad(p + "/activate", "POST", activation(), 403, editor.token);
const ac = activation(),
  plan = await call(p + "/activate", "POST", ac);
assert.equal(
  (await call(p + "/activate", "POST", ac)).frozenHash,
  plan.frozenHash,
);
w = await call(p);
assert.equal(w.snapshot.members.length, 2);
assert.ok(
  w.snapshot.clauses.some(
    (v) =>
      v.key === "__final:change:1" &&
      v.requirementText.includes("可编辑交付副本"),
  ),
);
assert.equal(w.snapshot.subjects.length, 2);
assert.equal(w.snapshot.requirementsHash, fq.campaign.requirementsHash);
assert.equal(w.snapshot.subjects[0].responseHash, accepted[0].hash);
assert.ok(!JSON.stringify(w).includes("PRIVATE-TOTAL"));
await bad(p + "/mine", "GET", undefined, 403);
const downloaded = await download(
  w.snapshot.subjects[0].attachmentId,
  editor.token,
);
assert.equal(downloaded.status, 200);
const downloadedBytes = Buffer.from(await downloaded.arrayBuffer());
assert.match(downloadedBytes.toString(), /合成/);
assert.equal(
  createHash("sha256").update(downloadedBytes).digest("hex"),
  w.snapshot.subjects[0].responseHash,
);
pass(
  "New confirmed campaigns require final review; frozen organizer duties and exact final requirements/response bytes gate activation and reviewer downloads",
);
let em = await call(p + "/mine", "GET", undefined, editor.token),
  vm = await call(p + "/mine", "GET", undefined, viewer.token);
assert.equal(em.sheet.entriesJson, "[]");
assert.equal(vm.sheet.entriesJson, "[]");
const partial = {
  expectedVersion: em.sheet.version,
  expectedFingerprint: em.fingerprint,
  entries: [
    {
      participationId: a,
      criterionKey: w.snapshot.criteria[0].key,
      score: "2",
      conclusion: null,
      evidence: "最终响应第1页",
      opinion: "PRIVATE-FINAL-EDITOR-DRAFT",
    },
  ],
  idempotencyKey: crypto.randomUUID(),
  userId: viewer.userId,
};
const saved = await call(p + "/mine", "PUT", partial, editor.token);
assert.equal(saved.userId, editor.userId);
assert.equal(
  (await call(p + "/mine", "GET", undefined, viewer.token)).sheet.entriesJson,
  "[]",
);
assert.ok(
  !JSON.stringify(await call(p)).includes("PRIVATE-FINAL-EDITOR-DRAFT"),
);
await bad(
  p + "/mine",
  "PUT",
  { ...partial, idempotencyKey: crypto.randomUUID() },
  409,
  editor.token,
);
em = await call(p + "/mine", "GET", undefined, editor.token);
await bad(
  p + "/mine/submit",
  "POST",
  {
    expectedVersion: em.sheet.version,
    expectedFingerprint: em.fingerprint,
    evidenceVersionId: s.proofId,
    personallyConfirmed: true,
    idempotencyKey: crypto.randomUUID(),
  },
  400,
  editor.token,
);
await bad(
  p + "/mine",
  "PUT",
  {
    expectedVersion: em.sheet.version,
    expectedFingerprint: em.fingerprint,
    entries: [{ ...partial.entries[0], participationId: "foreign" }],
    idempotencyKey: crypto.randomUUID(),
  },
  400,
  editor.token,
);
pass(
  "Independent drafts start empty; spoofed user IDs, cross-supplier cells, incomplete submissions and stale versions cannot replace another member or manufacture results",
);
const ir = "/evaluation/packages/" + pkg + "/rounds/" + f.roundId,
  oldFingerprint = em.fingerprint;
const incident = await call(ir + "/incidents", "POST", {
  kind: "network_failure",
  title: "合成最终响应暂停",
  occurredAt: new Date(Date.now() - 60000).toISOString(),
  responsibleId: s.userId,
  impactScope: "最终响应独立复核",
  description: "合成故障",
  evidenceVersionId: s.proofId,
  effect: "pause",
  restorationConditions: "处理并独立恢复",
  reviewed: true,
  idempotencyKey: crypto.randomUUID(),
});
await bad(
  p + "/mine",
  "PUT",
  {
    ...partial,
    expectedVersion: em.sheet.version,
    idempotencyKey: crypto.randomUUID(),
  },
  400,
  editor.token,
);
await bad(
  p + "/mine/submit",
  "POST",
  {
    expectedVersion: em.sheet.version,
    expectedFingerprint: em.fingerprint,
    evidenceVersionId: s.proofId,
    personallyConfirmed: true,
    idempotencyKey: crypto.randomUUID(),
  },
  400,
  editor.token,
);
assert.equal(
  (await call(p + "/mine", "GET", undefined, editor.token)).sheet.entriesJson,
  em.sheet.entriesJson,
);
await call(ir + "/incidents/" + incident.id + "/resolve", "POST", {
  expectedVersion: incident.version,
  handledAt: new Date().toISOString(),
  outcome: "continue_ready",
  evidenceVersionId: s.proofId,
  conditionsChecked: true,
  note: "合成故障处理",
  idempotencyKey: crypto.randomUUID(),
});
const iw = await call(ir + "/incidents");
await call(ir + "/control/resume", "POST", {
  expectedVersion: iw.control.version,
  casesFingerprint: iw.casesFingerprint,
  evidenceVersionId: s.proofId,
  reviewed: true,
  reason: "合成独立恢复",
  idempotencyKey: crypto.randomUUID(),
});
await bad(
  p + "/mine",
  "PUT",
  {
    ...partial,
    expectedVersion: em.sheet.version,
    expectedFingerprint: oldFingerprint,
    idempotencyKey: crypto.randomUUID(),
  },
  409,
  editor.token,
);
pass(
  "Pause preserves private drafts and blocks save/submit; independent resume invalidates the old basis fingerprint",
);
async function finalOpinion(f, u, scores, conclusion = "pass") {
  const path = f.root + "/final-response-review/mine";
  let m = await call(path, "GET", undefined, u.token);
  const entries = m.snapshot.subjects.flatMap((v, i) =>
    m.snapshot.criteria.map((c) => ({
      participationId: v.participationId,
      criterionKey: c.key,
      score:
        c.resultType === "score" ? (c.key === "T1" ? scores[i] : "0") : null,
      conclusion: c.resultType === "score" ? null : conclusion,
      evidence: "实际最终响应第2页及共同需求条款",
      opinion: "PRIVATE-FINAL-OPINION-" + u.userId,
    })),
  );
  await call(
    path,
    "PUT",
    {
      expectedVersion: m.sheet.version,
      expectedFingerprint: m.fingerprint,
      entries,
      idempotencyKey: crypto.randomUUID(),
    },
    u.token,
  );
  m = await call(path, "GET", undefined, u.token);
  const d = {
    expectedVersion: m.sheet.version,
    expectedFingerprint: m.fingerprint,
    evidenceVersionId: s.proofId,
    personallyConfirmed: true,
    idempotencyKey: crypto.randomUUID(),
  };
  const r = await call(path + "/submit", "POST", d, u.token);
  assert.equal(
    (await call(path + "/submit", "POST", d, u.token)).frozenHash,
    r.frozenHash,
  );
  return r;
}
const editorSheet = await finalOpinion(f, editor, ["2", "4"]);
preview = await call(f.root + "/price-calculations/preview", "POST", scope);
assert.ok(
  preview.blockers.some((v) => v.includes("最终响应独立复核尚未全部提交")),
);
const viewerSheet = await finalOpinion(f, viewer, ["4", "6"]);
await bad(
  p + "/mine",
  "PUT",
  {
    ...partial,
    expectedVersion: editorSheet.version,
    idempotencyKey: crypto.randomUUID(),
  },
  400,
  editor.token,
);
const ps = await price(f);
let ruleRow = await call(f.root + "/totals/rule", "PUT", save(cfg()));
await call(f.root + "/totals/rule/freeze", "POST", freeze(ruleRow));
const total = await call(f.root + "/totals/preview", "POST", {
  priceCalculationId: ps.id,
});
assert.deepEqual(total.blockers, []);
assert.deepEqual(
  total.trace.subjects.map((v) => v.total),
  ["51.00", "45.00"],
);
const technical = total.trace.subjects[0].components.find(
  (v) => v.criterionKey === "T1",
);
assert.deepEqual(
  new Set(technical.references.map((v) => v.id)),
  new Set([editorSheet.id, viewerSheet.id]),
);
await call(f.root + "/totals", "POST", confirm(total, ps.id));
pass(
  "All final members must submit; totals use new final scores (51.00/45.00) and exact final-sheet references instead of the initial 79.00/52.00 opinions",
);
const conflict = await make("最终响应分歧阻断验收");
await submit(conflict, editor, ["8", "8"], ["0", "0"]);
await submit(conflict, viewer, ["6", "6"], ["0", "0"]);
await final(conflict, ["100", "300"]);
let cw = await call(conflict.root + "/final-response-review");
await call(conflict.root + "/final-response-review/activate", "POST", {
  ...activation(),
  expectedVersion: 0,
  expectedFingerprint: cw.fingerprint,
  idempotencyKey: crypto.randomUUID(),
});
await finalOpinion(conflict, editor, ["2", "4"], "fail");
await finalOpinion(conflict, viewer, ["4", "6"], "pass");
const blocked = await call(
  conflict.root + "/price-calculations/preview",
  "POST",
  scope,
);
assert.equal(blocked.trace, null);
assert.ok(blocked.blockers.some((v) => v.includes("结论分歧")));
assert.ok(
  !JSON.stringify(
    await call(conflict.root + "/final-response-review"),
  ).includes("PRIVATE-FINAL-OPINION"),
);
assert.ok(
  !JSON.stringify(await call("/execution/packages/" + pkg)).includes(
    "PRIVATE-FINAL-OPINION",
  ),
);
pass(
  "Conflicting final conclusions block calculation without majority voting; progress/events expose no private opinions and submitted records remain immutable",
);
const finalOnly = await make("最终评分不强制初次重复计分验收");
await final(finalOnly, ["100", "300"]);
let fw = await call(finalOnly.root + "/final-response-review");
await call(finalOnly.root + "/final-response-review/activate", "POST", {
  ...activation(),
  expectedVersion: 0,
  expectedFingerprint: fw.fingerprint,
  idempotencyKey: crypto.randomUUID(),
});
await finalOpinion(finalOnly, editor, ["2", "4"]);
await finalOpinion(finalOnly, viewer, ["4", "6"]);
const finalOnlyPrice = await price(finalOnly);
assert.ok(finalOnlyPrice.id);
assert.equal(
  (
    await call(
      finalOnly.root + "/mine?stage=evaluation",
      "GET",
      undefined,
      editor.token,
    )
  ).sheets[0].status,
  "draft",
);
pass(
  "Active final review replaces preliminary scoring as the calculation prerequisite without bypassing earlier qualification/conformity stages or inventing initial scores",
);

const legacy = JSON.parse(
  await fs.readFile(".p0/p3-final-response-legacy-session.json"),
);
assert.ok(legacy.tenantId.startsWith("agency-assessment-"));
await refresh(legacy);
const lr =
  "/evaluation/packages/" + legacy.packageId + "/sessions/" + legacy.sessionId;
assert.equal(
  (await call(lr + "/final-response-review", "GET", undefined, legacy.token))
    .mode,
  "legacy",
);
const oldPrices = await call(
  lr + "/price-calculations",
  "GET",
  undefined,
  legacy.token,
);
assert.ok(
  oldPrices.history.some(
    (v) =>
      v.calculation.id === legacy.legacyPriceId &&
      !v.stale &&
      Date.parse(v.calculation.createdAt) <
        Date.parse(legacy.migrationInstalledAt),
  ),
);
pass(
  "Only pre-migration confirmed campaigns retain explicit legacy review, and valid historical price calculations remain current without fabricated sheets",
);
const browser = await make("最终响应独立复核浏览器验收");
await submit(browser, editor, ["8", "8"], ["0", "0"]);
await submit(browser, viewer, ["6", "4"], ["0", "0"]);
await recordCommonChange(browser);
await final(browser, ["100", "300"]);
await fs.writeFile(
  ".p0/p3-final-response-browser-session.json",
  JSON.stringify({ ...s, ...browser, reviewers: [editor, viewer] }),
  { mode: 0o600 },
);
await fs.writeFile(
  ".p0/p3-final-response-smoke-result.json",
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      scope:
        "Synthetic consultation final-response review and exact final-score provenance; method matrix unit-tested; no production/six-method business acceptance",
    },
    null,
    2,
  ),
);
console.log("Final response HTTP passed:", checks.length);
