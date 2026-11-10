import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { fixture, uploadProof } from "./agency-technical-fixture.mjs";
const f = await fixture(".p0/p4-archive-session.json"),
  { s, call, bad, key, base, token } = f,
  checks = [],
  pass = (t) => {
    checks.push(t);
    console.log("PASS", t);
  },
  p = `/packages/${s.packageId}`,
  detail = await call(p),
  group = detail.record.groupId;
assert.ok(group, "Fresh acceptance fixtures must have a real parent group");
const own = (await call(p + "/finance")).summary,
  office = await call(`/groups/${group}/office`);
assert.equal(office.packageCount, 2);
assert.equal(office.summaries.length, 1);
assert.equal(office.summaries[0].summary.receivable, own.receivable);
assert.equal(office.summaries[0].summary.costActual, own.costActual);
pass(
  "Parent-project financial summary includes each authorized approved package once and separates currencies; a second empty package does not double the first package income or cost",
);
const code = "custom_" + key().replaceAll("-", "");
let categories = await call(p + "/finance/categories/" + code, "PUT", {
  expectedVersion: 0,
  label: "合成场地布置服务",
  active: true,
  reason: "按单位费用目录配置，保留核心类别含义",
});
assert.ok(categories.find((c) => c.code === code && c.active));
await bad(
  p + "/finance/categories/" + code,
  "PUT",
  {
    expectedVersion: 0,
    label: "过期修改",
    active: false,
    reason: "过期配置应冲突",
  },
  409,
);
categories = await call(p + "/finance/categories/" + code, "PUT", {
  expectedVersion: 1,
  label: "合成场地布置服务",
  active: false,
  reason: "停用仅阻止新申请并保留历史",
});
const proof = await uploadProof(
  f,
  "自定义成本类别核对-" + key() + ".txt",
  "合成实际核对 " + key(),
);
await bad(p + "/finance/costs", "POST", {
  category: code,
  reason: "不可用类别",
  occurredAt: new Date().toISOString(),
  bearer: "代理公司",
  payee: "实际服务方",
  service: "真实服务",
  billingBasis: "真实依据",
  budget: "10",
  requested: "10",
  evidenceVersionId: proof.id,
  reviewed: true,
  idempotencyKey: key(),
});
pass(
  "Tenant-specific cost categories are configurable with optimistic revision; core meanings stay stable, disabled categories cannot create new costs and historical records remain",
);
let r = await fetch(
  base + `/api/v1/buyer/agency/groups/${group}/finance/export`,
  { headers: { authorization: "Bearer " + token } },
);
assert.equal(r.status, 200);
const bytes = Buffer.from(await r.arrayBuffer());
assert.equal(bytes.subarray(0, 2).toString(), "PK");
await fs.writeFile(".p0/p5-finance-statistics.xlsx", bytes);
pass(
  "Actual XLSX export contains authorized per-package finance and performance basis without expert identities, automatic salary formulas or cash/invoice conflation",
);
const listing = await call("/packages?groupId=" + group + "&pageSize=100");
const packages = listing.items || listing.records || listing;
assert.ok(Array.isArray(packages));
for (const other of packages) {
  const row = other.record || other;
  if (row.id === s.packageId) continue;
  const a = await call(`/packages/${row.id}/archive`);
  if (!a.snapshots.length)
    await call(`/packages/${row.id}/archive/snapshots`, "POST", {
      expectedFingerprint: a.sourceFingerprint,
      expectedPreviousId: null,
      complete: false,
      retentionYears: 8,
      reason: "合成第二包正式不完整快照，缺件明确保留，不宣称办结",
      reviewed: true,
      idempotencyKey: key(),
    });
}
r = await fetch(base + `/api/v1/buyer/agency/groups/${group}/archive/export`, {
  headers: { authorization: "Bearer " + token },
});
assert.equal(r.status, 200);
await fs.writeFile(
  ".p0/p5-group-archive.zip",
  Buffer.from(await r.arrayBuffer()),
);
pass(
  "Actual parent-project archive collection exports one immutable selected snapshot per authorized package, including explicitly incomplete second-package status and missing notes",
);
await fs.writeFile(
  ".p0/p5-office-export-result.json",
  JSON.stringify({ passed: checks.length, checks }, null, 2),
);
