import {
  prepareMaterialOpening,
  uploadReceiptVersion,
} from "./agency-material-opening-support.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  baseUrl,
  requestJson,
  runLocalSmokeSql,
  sqlLiteral as q,
} from "./java-smoke-support.mjs";
assert.equal(
  baseUrl,
  "http://127.0.0.1:18080",
  "Only the isolated P1 API is allowed",
);
assert.ok(
  process.env.JAVA_SMOKE_DATABASE_URL?.endsWith("/procurement_agency_p0"),
  "Only the isolated P1 database is allowed",
);
const mark = Date.now(),
  tenant = `agency-assessment-${mark}`,
  other = `agency-assessment-other-${mark}`,
  dept = `agency-dept-${mark}`,
  dept2 = `agency-dept2-${mark}`;
const ids = Object.fromEntries(
  ["creator", "reviewer", "outsider", "viewer", "editor", "other"].map((k) => [
    k,
    `agency-${k}-${mark}`,
  ]),
);
const hash = "$2y$10$HKSnHnokVMkEYDQUlfB/e..3beDCFeM8KKj9.ZpFHGPTQeTjIKP.O";
const checks = [];
const pass = (name) => {
  checks.push(name);
  console.log("PASS", name);
};
runLocalSmokeSql(`insert into tenants(id,name,plan,status,user_limit) values(${q(tenant)},'代理验收公司','pro','active',100),(${q(other)},'其他验收公司','pro','active',100);
 insert into departments(id,tenant_id,name,status) values(${q(dept)},${q(tenant)},'代理一部','active'),(${q(dept2)},${q(tenant)},'其他部门','active');
 ${Object.entries(ids)
   .map(
     ([
       role,
       id,
     ]) => `insert into users(id,tenant_id,name,email,status,department_id,password_hash) values(${q(id)},${q(role === "other" ? other : tenant)},${q("P1 " + role)},${q(id + "@example.com")},'active',${role === "other" ? "null" : q(role === "outsider" || role === "viewer" || role === "editor" ? dept2 : dept)},${q(hash)});
 insert into roles(id,tenant_id,scope,name,permissions,data_scope) values(${q(id + "-role")},${q(role === "other" ? other : tenant)},'buyer',${q("P1 " + role)},'["buyer:*"]',${q(role === "reviewer" || role === "other" ? "all" : "self")});
 insert into user_roles(user_id,role_id) values(${q(id)},${q(id + "-role")});`,
   )
   .join("\n")}`);
async function login(key) {
  return (
    await requestJson("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        account: ids[key] + "@example.com",
        password: "demo123456",
        scope: "BUYER",
        tenantId: key === "other" ? other : tenant,
      }),
    })
  ).accessToken;
}
const tokens = Object.fromEntries(
  await Promise.all(Object.keys(ids).map(async (k) => [k, await login(k)])),
);
const headers = (k) => ({
  authorization: "Bearer " + tokens[k],
  "content-type": "application/json",
});
async function call(path, method = "GET", body, key = "creator") {
  return requestJson("/api/v1/buyer/agency" + path, {
    method,
    headers: headers(key),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function denied(path, method, body, status, key = "creator") {
  await assert.rejects(
    () => call(path, method, body, key),
    new RegExp("failed: " + status),
  );
}
const ex = (p, m = "GET", b, k = "creator") => call("/execution" + p, m, b, k);
async function no(p, m, b, status = 400, k = "creator") {
  await denied("/execution" + p, m, b, status, k);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function done(id, action = "approve") {
  const tasks = await requestJson("/api/v1/buyer/workflow/tasks", {
    headers: headers("reviewer"),
  });
  const task = tasks.find((t) => t.businessId === id);
  assert.ok(task, "real independent Flowable task for " + id);
  await requestJson(`/api/v1/buyer/workflow/tasks/${task.taskId}/complete`, {
    method: "POST",
    headers: headers("reviewer"),
    body: JSON.stringify({
      action,
      comment: "P2 synthetic verification " + action,
    }),
  });
}
for (const type of [
  "agency_package_archive",
  "agency_package_change",
  "agency_template_publication",
  "agency_purchase_document",
  "agency_announcement",
]) {
  const d = await requestJson("/api/v1/buyer/process-definitions", {
    method: "POST",
    headers: headers("reviewer"),
    body: JSON.stringify({ name: "P2 " + type, businessType: type }),
  });
  await requestJson("/api/v1/buyer/process-definitions/" + d.id, {
    method: "PUT",
    headers: headers("reviewer"),
    body: JSON.stringify({
      name: d.name,
      status: "draft",
      businessType: type,
      formSchema: JSON.stringify({ fields: [] }),
      flowSchema: JSON.stringify({
        steps: [
          {
            id: "review",
            type: "approver",
            title: "Independent reviewer",
            assignment: { type: "user", userId: ids.reviewer },
          },
        ],
      }),
    }),
  });
  await requestJson(`/api/v1/buyer/process-definitions/${d.id}/publish`, {
    method: "POST",
    headers: headers("reviewer"),
  });
}
pass("Five real workflow definitions published");
const fixtureGroup=await call("/groups","POST",{name:"合成一期技术验收所属项目-"+mark,tags:"仅独立技术样本"});
const draft = {
  groupId:fixtureGroup.id,
  title: "P3 评审准备合成验收",
  businessCategory: "ZC",
  objectCode: "FW",
  procurementMethod: process.env.AGENCY_CASE_METHOD,
  regime: "政府采购",
  region: "合成验收地区",
  operatingMode: "half",
  departmentId: dept,
  ownerId: ids.creator,
  budget: "100000",
  ceiling: "99000",
  currency: "CNY",
  purchaser: { name: "合成采购人", contact: "测试联系人" },
  entrustment: { status: "洽谈中" },
  feeAgreement: { payer: "合成采购人", basis: "按真实约定人工核算，不预设收费标准" },
  supplement: {},
  members: [
    { userId: ids.viewer, role: "VIEWER" },
    { userId: ids.editor, role: "EDITOR" },
    { userId: ids.reviewer, role: "EDITOR" },
  ],
};
async function makePackage(
  title = draft.title,
  method = draft.procurementMethod,
) {
  let p = await call("/packages", "POST", {
    ...draft,
    title,
    procurementMethod: method,
  });
  await no(`/packages/${p.record.id}`, "GET", undefined, 400);
  p = await call(`/packages/${p.record.id}/submit`, "POST", {
    expectedVersion: p.record.version,
    idempotencyKey: crypto.randomUUID(),
  });
  await done(p.reviews[0].id);
  return call("/packages/" + p.record.id);
}
let detail = await makePackage(),
  pkg = detail.record.id;
await makePackage("同所属项目第二包（仅验证汇总与不完整快照）");
let w = await ex("/packages/" + pkg);
assert.ok(w.milestones.length >= 8);
assert.equal(w.aiEnabled, false);
assert.equal(w.onlineOfficeEnabled, false);
assert.equal(
  (await ex("/packages/" + pkg)).milestones.length,
  w.milestones.length,
);
pass("Archive gate, one-time plan initialization and dependency flags");
await no(`/packages/${pkg}`, "GET", undefined, 403, "outsider");
await no(`/packages/${pkg}`, "GET", undefined, 403, "other");
pass("Execution scope and tenant isolation");
async function upload(name, bytes, visibility = "project", target = pkg) {
  let file = await call(`/packages/${target}/files`, "POST", {
    name,
    category: "demand_source",
    visibility,
  });
  let v = file.versions[0];
  const b = {
    ownerType: "agency_file_version",
    ownerId: v.id,
    fileName: name,
    visibility: "buyer_internal",
  };
  const ticket = await requestJson("/api/v1/buyer/attachments/upload-ticket", {
    method: "POST",
    headers: headers("creator"),
    body: JSON.stringify(b),
  });
  const r = await fetch(baseUrl + ticket.uploadUrl, {
    method: "POST",
    headers: {
      authorization: "Bearer " + tokens.creator,
      "content-type": "application/octet-stream",
    },
    body: Buffer.from(bytes),
  });
  assert.equal(r.status, 200, await r.text());
  const a = await requestJson("/api/v1/buyer/attachments", {
    method: "POST",
    headers: headers("creator"),
    body: JSON.stringify({ ...b, storageKey: ticket.storageKey }),
  });
  return call(`/file-versions/${v.id}/seal`, "POST", { attachmentId: a.id });
}
const source = await upload(
  "需求资料.txt",
  "采购内容：合成技术咨询服务\n履行期限：一年\n验收要求：技术报告",
);
const source2 = await upload("补充需求.txt", "履行期限：两年");
const secret = await upload("保密资料.txt", "履行期限：三年", "restricted");
await no(`/packages/${pkg}/extractions`, "POST", {
  sourceVersionIds: [secret.id],
  idempotencyKey: crypto.randomUUID(),
});
async function poll(job) {
  for (let i = 0; i < 100; i++) {
    const j = await ex("/jobs/" + job.id);
    if (!["queued", "processing"].includes(j.status)) return j;
    await wait(200);
  }
  throw Error("job timeout");
}
let job = await ex(`/packages/${pkg}/extractions`, "POST", {
  sourceVersionIds: [source.id, source2.id],
  idempotencyKey: crypto.randomUUID(),
});
job = await poll(job);
assert.equal(job.status, "success", job.errorText);
w = await ex("/packages/" + pkg);
assert.ok(w.requirements.length >= 3);
assert.ok(w.requirements.every((r) => r.status !== "confirmed"));
assert.ok(w.requirements.some((r) => r.status === "conflict"));
pass(
  "Asynchronous deterministic extraction, conflicts and source confidentiality",
);
let item = w.requirements.find(
  (r) => r.fieldKey === "履行期限" && r.valueText === "一年",
);
assert.ok(item);
item = await ex(`/packages/${pkg}/requirements/${item.id}`, "PUT", {
  ...item,
  expectedVersion: item.version,
  status: "confirmed",
});
await no(
  `/packages/${pkg}/requirements/${item.id}`,
  "PUT",
  { ...item, expectedVersion: 1, status: "confirmed" },
  409,
);
const conflict = w.requirements.find(
  (r) => r.fieldKey === "履行期限" && r.valueText === "两年",
);
await no(`/packages/${pkg}/requirements/${conflict.id}`, "PUT", {
  ...conflict,
  expectedVersion: conflict.version,
  status: "confirmed",
});
item = await ex(`/packages/${pkg}/requirements/${item.id}`, "PUT", {
  ...item,
  expectedVersion: item.version,
  valueText: "一年（人工复核）",
  status: "confirmed",
});
assert.equal(item.status, "confirmed");
pass(
  "Manual confirmation, own-row correction and optimistic conflict detection",
);
const chapters = [
  {
    code: "notice",
    title: "采购公告或邀请",
    body: "项目：{{projectTitle}}\n编号：{{projectNumber}}\n采购人：{{purchaserName}}",
    required: true,
  },
  {
    code: "instructions",
    title: "须知与前附表",
    body: "供应商应按采购文件提交响应文件。",
    required: true,
  },
  {
    code: "demand",
    title: "采购需求",
    body: "履行期限：{{requirement.履行期限}}\n交付合成技术报告。",
    required: true,
  },
  {
    code: "evaluation",
    title: "评审办法",
    body: "本条为合成技术验证内容，须人工复核正式办法。",
    required: true,
  },
  {
    code: "contract",
    title: "合同条款",
    body: "成交供应商：{{supplierName}}\n成交金额：{{awardAmount}}",
    required: true,
  },
  {
    code: "response",
    title: "响应格式",
    body: "响应函、报价表及服务方案。",
    required: true,
  },
];
const templateBody = {
  name: "P2 合成服务采购模板",
  scope: "company",
  procurementMethod: draft.procurementMethod,
  sourceNote: "合成测试模板；未作为实际法律或采购依据",
  description: "technical fixture",
  sections: chapters,
};
let template = await ex("/templates", "POST", templateBody),
  tv = template.versions[0];
let views = await ex(`/packages/${pkg}/documents`, "POST");
let purchase = views.find((v) => v.document.kind === "purchase"),
  announcement = views.find((v) => v.document.kind === "announcement");
await no(`/documents/${purchase.document.id}/template`, "POST", {
  expectedVersion: purchase.document.version,
  templateVersionId: tv.id,
});
pass("Unpublished company template cannot be selected");
tv = await ex(`/template-versions/${tv.id}/submit`, "POST", {
  idempotencyKey: crypto.randomUUID(),
  formData: {},
});
await done(tv.id);
template = (await ex(`/packages/${pkg}/templates`)).find(
  (t) => t.template.id === template.template.id,
);
assert.equal(template.versions[0].status, "published");
purchase = await ex(`/documents/${purchase.document.id}/template`, "POST", {
  expectedVersion: purchase.document.version,
  templateVersionId: tv.id,
});
announcement = await ex(
  `/documents/${announcement.document.id}/template`,
  "POST",
  { expectedVersion: announcement.document.version, templateVersionId: tv.id },
);
assert.equal(purchase.sections.length, chapters.length);
assert.equal(announcement.sections.length, 1);
pass("Company template independent approval and separate document snapshots");
const oldTemplateOrdinal = template.versions[0].ordinal;
template = await ex(`/templates/${template.template.id}/versions`, "POST", {
  ...templateBody,
  expectedVersion: template.template.version,
  sections: chapters.map((c) => ({ ...c, body: c.body + "\n新版本内容" })),
  sourceNote: "合成模板 V2",
});
w = await ex("/packages/" + pkg);
assert.equal(
  w.documents.find((v) => v.document.id === purchase.document.id).sections[0]
    .body,
  chapters[0].body,
);
assert.ok(template.versions.some((v) => v.ordinal === oldTemplateOrdinal + 1));
pass("Template next version never rewrites existing document chapters");
let frozen = await ex(`/documents/${purchase.document.id}/compose`, "POST", {
  expectedVersion: purchase.document.version,
  idempotencyKey: "compose-" + mark,
});
assert.equal(
  (
    await ex(`/documents/${purchase.document.id}/compose`, "POST", {
      expectedVersion: purchase.document.version,
      idempotencyKey: "compose-" + mark,
    })
  ).id,
  frozen.id,
);
frozen = await poll(frozen);
assert.equal(frozen.status, "success", frozen.errorText);
let revisionId = JSON.parse(frozen.resultJson).revisionId;
const artifact = await ex(`/revisions/${revisionId}/artifact`);
const downloaded = await fetch(
  baseUrl + `/api/v1/buyer/attachments/${artifact.attachmentId}/download`,
  { headers: headers("creator") },
);
assert.equal(downloaded.status, 200);
const docx = Buffer.from(await downloaded.arrayBuffer());
assert.equal(docx.subarray(0, 2).toString(), "PK");
await fs.writeFile(".p0/p2-generated.docx", docx);
pass(
  "Asynchronous real DOCX composition, idempotency and immutable byte download",
);
await ex(`/revisions/${revisionId}/submit`, "POST", {
  idempotencyKey: crypto.randomUUID(),
  formData: {},
});
await done(revisionId);
assert.ok(["邀请招标", "询价", "单一来源"].includes(draft.procurementMethod));
checks.length = 0;
const method = draft.procurementMethod,
  key =
    method === "邀请招标"
      ? "invitation"
      : method === "询价"
        ? "inquiry"
        : "single",
  amounts = ["100.00", "300.00"];
const subjects = [];
for (let i = 0; i < (key === "single" ? 1 : 2); i++)
  subjects.push(
    await ex(`/packages/${pkg}/participations`, "POST", {
      supplierName: "专有程序合成供应商" + (i + 1),
      creditCode: null,
      contact: "合成联系人",
      phone: "000000",
      source: "合成业务凭证，不限制采购文件获取",
      acquisitionStatus: "unknown",
      submissionStatus: "unknown",
      riskNote: "无自动资格认定",
      riskStatus: "pending",
      evidenceVersionId: source.id,
      notes: "技术测试样例",
    }),
  );
const criterion = (id, stage) => ({
  key: id,
  title: id + "合成实质响应核对",
  stage,
  applicableTo: "全部已开启对象",
  resultType: "pass_fail",
  minimum: "0",
  maximum: "0",
  weight: "0",
  formula: "none",
  evidenceRequired: true,
  scale: 2,
  rounding: "HALF_UP",
});
const rules = [
  ...(key === "invitation"
    ? [criterion("Q1", "qualification"), criterion("C1", "conformity")]
    : []),
  criterion("T1", "technical"),
].map((r) => ({
  documentRule: r,
  configuredRule: r,
  locator: "原文件合成条款位置，实际样例另验",
  manuallyChecked: true,
}));
const cfg = {
  title: method + "专有程序合成验收",
  documentRevisionId: revisionId,
  evaluationMethod:
    key === "invitation"
      ? "lowest_price"
      : key === "inquiry"
        ? "price_comparison"
        : "consultation",
  ruleVersion: "METHOD-V1",
  ruleBasis: "合成技术样例，不作为真实规则或法定数量认定",
  venue: "合成业务室",
  scheduledAt: new Date(Date.now() + 3600000).toISOString(),
  members: [
    {
      userId: ids.creator,
      roles: ["organizer", "qualification_reviewer", "conformity_reviewer"],
    },
    { userId: ids.editor, roles: ["review_member"] },
    { userId: ids.reviewer, roles: ["organizer"] },
  ],
  rules,
  tieRule: "同价待有权处理，不自动推荐",
};
const root = `/evaluation/packages/${pkg}/rounds`;
let v = await call(root, "POST", {
  expectedVersion: 0,
  config: cfg,
  reason: "合成方式专有程序技术验收",
  idempotencyKey: crypto.randomUUID(),
});
v = await call(root + "/" + v.round.id + "/freeze", "POST", {
  expectedVersion: v.round.version,
  businessRulesReviewed: true,
  reason: "原文与实际方式、职责人工核对",
  idempotencyKey: crypto.randomUUID(),
});
const round = v.round.id,
  procedure = root + "/" + round + "/procedures",
  clock = Date.now() - 7200000,
  at = (m) => new Date(clock + m * 60000).toISOString(),
  pids = subjects.map((s) => s.id);
await denied(procedure, "GET", undefined, 403, "outsider");
await denied(
  procedure + "/invitation",
  "POST",
  { reviewed: true },
  key === "invitation" ? 400 : 400,
);
let opened;
if (key === "invitation" || key === "single") {
  await assert.rejects(
    () =>
      prepareMaterialOpening({
        call,
        headers,
        pkg,
        round,
        participantIds: pids,
        proofId: source.id,
        clock,
      }),
    /failed: 400/,
  );
  if (key === "invitation") {
    const body = {
      expectedPreviousHash: null,
      selectionMode: "external_lottery",
      formedAt: at(-30),
      formationBasis: "合成名单来源及实际外部抽取结果；不由系统随机选择",
      participants: subjects.map((s) => ({
        participationId: s.id,
        sourceNote: "合成候选来源名册",
        verificationMode: "not_applicable",
        verificationBasis: "本合成条件不采用统一预审；实际项目按文件核验",
        selectionBasis: "合成外部抽取及邀请依据",
        sentAt: at(-20),
        receivedAt: at(-10),
        deliveryStatus: "received",
        recipient: "合成实际接收人及来源",
        evidenceVersionId: source.id,
      })),
      evidenceVersionId: source.id,
      reviewed: true,
      reason: "合成邀请程序与送达核对，不限制供应商获取文件",
      idempotencyKey: crypto.randomUUID(),
    };
    await denied(
      procedure + "/invitation",
      "POST",
      {
        ...body,
        participants: [{ ...body.participants[0], participationId: "foreign" }],
        idempotencyKey: crypto.randomUUID(),
      },
      400,
    );
    await denied(procedure + "/invitation", "POST", body, 403, "editor");
    const saved = await call(procedure + "/invitation", "POST", body);
    assert.equal(
      (await call(procedure + "/invitation", "POST", body)).frozenHash,
      saved.frozenHash,
    );
    pass(
      "Formal opening is blocked without invitation provenance; true external selection, non-default prequalification applicability and per-recipient delivery evidence are required and immutable",
    );
  } else {
    const body = {
      expectedPreviousHash: null,
      grounds: "合成单一来源适用理由及实际论证依据，不是系统自动认定",
      approvalApplicability: "required",
      approvalNote: "已取得合成外部审批凭证",
      approvalVersionId: source.id,
      publicationApplicability: "not_applicable",
      publicationNote: "合成制度边界下不适用；实际业务另按有权依据核对",
      publicationVersionId: null,
      evidenceVersionId: source.id,
      reviewed: true,
      reason: "人工核对适用理由、审批与公示条件",
      idempotencyKey: crypto.randomUUID(),
    };
    await denied(
      procedure + "/single-basis",
      "POST",
      { ...body, approvalVersionId: null, idempotencyKey: crypto.randomUUID() },
      400,
    );
    await call(procedure + "/single-basis", "POST", body);
    pass(
      "Sole-source opening requires actual grounds and explicit approval/publication applicability; not-applicable is an evidenced branch rather than a fabricated publication",
    );
  }
  const material = root + "/" + round + "/materials",
    ws = await call(material),
    preview = await call(material + "/preview", "POST", {
      participationIds: pids,
    });
  opened = await call(material + "/open", "POST", {
    expectedVersion: ws.plan.version,
    participationIds: pids,
    previewFingerprint: preview.fingerprint,
    openedAt: new Date(clock).toISOString(),
    evidenceVersionId: source.id,
    reviewed: true,
    note: "实际专有依据核对后正式开启合成材料",
    idempotencyKey: crypto.randomUUID(),
  });
  await denied(
    procedure + (key === "invitation" ? "/invitation" : "/single-basis"),
    "POST",
    {
      reviewed: true,
      reason: "不能事后覆盖",
      idempotencyKey: crypto.randomUUID(),
    },
    400,
  );
} else
  opened = (
    await prepareMaterialOpening({
      call,
      headers,
      pkg,
      round,
      participantIds: pids,
      proofId: source.id,
      clock,
    })
  ).opening;
const session = await call(root + "/" + round + "/assessment", "POST", {
    expectedRoundVersion: v.round.version,
    participationIds: pids,
    openingEvidenceVersionId: source.id,
    openedAt: opened.openedAt,
    openingReviewed: true,
    note: "方式专有程序合成技术验证",
    idempotencyKey: crypto.randomUUID(),
  }),
  sr = `/evaluation/packages/${pkg}/sessions/${session.id}`;
for (const stage of key === "invitation"
  ? ["qualification", "conformity", "evaluation"]
  : ["evaluation"]) {
  const who = stage === "evaluation" ? "editor" : "creator";
  let mine = await call(sr + "/mine?stage=" + stage, "GET", undefined, who);
  const entries = pids.flatMap((id) =>
    mine.criteria.map((r) => ({
      participationId: id,
      criterionKey: r.key,
      score: null,
      conclusion: "pass",
      evidence: "实际合成响应第1页",
      opinion: "本人独立核对，不代表真实资格判定",
    })),
  );
  await call(
    sr + "/mine?stage=" + stage,
    "PUT",
    {
      expectedVersion: mine.sheets[0].version,
      entries,
      idempotencyKey: crypto.randomUUID(),
    },
    who,
  );
  mine = await call(sr + "/mine?stage=" + stage, "GET", undefined, who);
  await call(
    sr + "/mine/submit?stage=" + stage,
    "POST",
    {
      expectedVersion: mine.sheets[0].version,
      personallyConfirmed: true,
      idempotencyKey: crypto.randomUUID(),
    },
    who,
  );
  const next =
    stage === "qualification"
      ? "conformity"
      : stage === "conformity"
        ? "evaluation"
        : null;
  if (next) {
    const board = await call(sr + "/stages"),
      n = board.stages.find((v) => v.stageKey === next);
    await call(sr + "/stages/" + next + "/release", "POST", {
      participationIds: pids,
      exclusions: {},
      prerequisiteHash: n.prerequisiteHash,
      evidenceVersionId: source.id,
      reviewed: true,
      note: "前序职责及对象逐项核对",
      idempotencyKey: crypto.randomUUID(),
    });
  }
}
if (key === "inquiry") {
  for (const [i, id] of pids.entries())
    await call(sr + "/quotes", "POST", {
      participationId: id,
      expectedPreviousId: null,
      kind: "original",
      amount: amounts[i],
      currency: "CNY",
      evidenceVersionId: source.id,
      reason: "真实一次报价合成副本，非二次竞价",
      reviewed: true,
      idempotencyKey: crypto.randomUUID(),
    });
  const initial = await call(sr + "/quotes");
  await denied(
    sr + "/quotes",
    "POST",
    {
      participationId: pids[0],
      expectedPreviousId: initial.find((v) => v.participationId === pids[0]).id,
      kind: "original",
      amount: "90",
      currency: "CNY",
      evidenceVersionId: source.id,
      reason: "不得第二次原始报价",
      reviewed: true,
      idempotencyKey: crypto.randomUUID(),
    },
    400,
  );
  let preview = await call(sr + "/price-calculations/preview", "POST", {
    participationIds: pids,
    exclusions: {},
  });
  assert.ok(preview.blockers.some((v) => v.includes("一次报价有效性")));
  const body = {
    expectedPreviousHash: null,
    offers: pids.map((id) => ({
      participationId: id,
      quoteLayerId: initial.find((v) => v.participationId === id).id,
      status: "valid",
      responseLocator: "实际一次报价第1页",
      handlingBasis: "合成有效性及异常处理依据，不推定资格",
      evidenceVersionId: source.id,
    })),
    oneOfferChecked: true,
    noNegotiationChecked: true,
    reviewed: true,
    reason: "人工核对原始金额、一次报价及适用修正",
    idempotencyKey: crypto.randomUUID(),
  };
  await denied(
    sr + "/procedures/inquiry",
    "POST",
    { ...body, oneOfferChecked: false },
    400,
  );
  await denied(
    sr + "/procedures/inquiry",
    "POST",
    { ...body, offers: body.offers.slice(0, 1) },
    400,
  );
  const rec = await call(sr + "/procedures/inquiry", "POST", body);
  const rule = {
    priceSource: "original",
    formula: "price_comparison",
    criterionKey: null,
    fullScore: "0",
    scale: 2,
    rounding: "HALF_UP",
    tieRule: "同价按有权程序处理，不自动排名",
  };
  let rr = await call(sr + "/price-calculations/rule", "PUT", {
    expectedVersion: 0,
    config: {
      ruleVersion: "INQUIRY-PRICE-V1",
      basis: "合成一次报价价格比较规则",
      locator: "合成文件价格比较条款",
      documentRule: rule,
      configuredRule: rule,
    },
    reason: "有据一次报价比较，不生成技术商务分",
    idempotencyKey: crypto.randomUUID(),
  });
  await call(sr + "/price-calculations/rule/freeze", "POST", {
    expectedVersion: rr.version,
    reviewed: true,
    reason: "核对原文明确价格层和同价处理",
    idempotencyKey: crypto.randomUUID(),
  });
  preview = await call(sr + "/price-calculations/preview", "POST", {
    participationIds: pids,
    exclusions: {},
  });
  assert.ok(!preview.blockers.some((v) => v.includes("一次报价有效性")));
  assert.deepEqual(preview.blockers, []);
  assert.ok(preview.trace.lines.every((v) => v.score === null));
  const pc = await call(sr + "/price-calculations", "POST", {
    scope: { participationIds: pids, exclusions: {} },
    fingerprint: preview.fingerprint,
    evidenceVersionId: source.id,
    reviewed: true,
    reason: "合成有效性与价格明细复核",
    idempotencyKey: crypto.randomUUID(),
  });
  const layer = initial.find((v) => v.participationId === pids[0]);
  await call(sr + "/quotes", "POST", {
    participationId: pids[0],
    expectedPreviousId: layer.id,
    kind: "correction",
    amount: "110",
    currency: "CNY",
    evidenceVersionId: source.id,
    reason: "有据修正不改原始金额",
    reviewed: true,
    idempotencyKey: crypto.randomUUID(),
  });
  preview = await call(sr + "/price-calculations/preview", "POST", {
    participationIds: pids,
    exclusions: {},
  });
  assert.ok(preview.blockers.some((v) => v.includes("一次报价来源层已变化")));
  assert.equal(
    (await call(sr + "/price-calculations")).history.find(
      (v) => v.calculation.id === pc.id,
    ).stale,
    true,
  );
  assert.equal(
    (await call(sr + "/quotes")).find((v) => v.participationId === pids[0])
      .originalAmount,
    "100.00",
  );
  const latest = await call(sr + "/quotes");
  await call(sr + "/procedures/inquiry", "POST", {
    ...body,
    expectedPreviousHash: rec.frozenHash,
    offers: pids.map((id) => ({
      ...body.offers.find((v) => v.participationId === id),
      quoteLayerId: latest.find((v) => v.participationId === id).id,
    })),
    idempotencyKey: crypto.randomUUID(),
  });
  pass(
    "Inquiry refuses a second original offer; complete validity evidence is mandatory, corrections retain the original and invalidate prior validity review until rechecked",
  );
  await denied(sr + "/final-quotes", "POST", { reviewed: true }, 400);
  pass(
    "Inquiry does not expose negotiation final quotes or comprehensive scoring despite wildcard permissions",
  );
} else if (key === "single") {
  const body = {
    expectedPreviousHash: null,
    participationId: pids[0],
    staffUserIds: [ids.editor],
    beganAt: at(5),
    endedAt: at(10),
    marketSourceVersionIds: [source.id],
    priceReasonability:
      "合成价格合理性资料、成本与市场依据分析，不采用竞争排名",
    qualityAssurance: "合成质量保障与实际履行承诺",
    agreedAmount: "100.00",
    currency: "CNY",
    supplierConfirmationNote: "线下实际协商确认凭证来源，不代表在线身份签署",
    evidenceVersionId: source.id,
    reviewed: true,
    reason: "专业人员实际协商结果核对",
    idempotencyKey: crypto.randomUUID(),
  };
  await denied(
    sr + "/procedures/negotiation",
    "POST",
    { ...body, staffUserIds: [ids.creator] },
    400,
  );
  await denied(
    sr + "/procedures/negotiation",
    "POST",
    { ...body, agreedAmount: "100000.00" },
    400,
  );
  const r = await call(sr + "/procedures/negotiation", "POST", body);
  assert.equal(
    (await call(sr + "/procedures/negotiation", "POST", body)).frozenHash,
    r.frozenHash,
  );
  assert.equal(JSON.parse(r.snapshotJson).content.agreedAmount, "100.00");
  await denied(sr + "/final-quotes", "POST", { reviewed: true }, 400);
  pass(
    "One-supplier professional negotiation records actual staff, price reasonability, quality and signed-source evidence without requiring three suppliers, competitive scores or final-quote transactions",
  );
} else
  pass(
    "Invitation evidence remains sealed after opening; existing qualification, conformity and evaluation stages still require separate responsible submissions",
  );
await fs.writeFile(
  `.p0/p3-method-${key}-session.json`,
  JSON.stringify({
    token: tokens.creator,
    userId: ids.creator,
    tenantId: tenant,
    displayName: "专有程序技术验证",
    packageId: pkg,
    roundId: round,
    sessionId: session.id,
    root: sr,
    proofId: source.id,
    revisionId,
    subjects,
    ids,
    tokens,
  }),
  { mode: 0o600 },
);
await fs.writeFile(
  `.p0/p3-method-${key}-result.json`,
  JSON.stringify(
    {
      passed: checks.length,
      checks,
      method,
      scope:
        "Synthetic offline method-specific procedure; no legal or production acceptance",
    },
    null,
    2,
  ),
);
console.log(method, "passed:", checks.length);
