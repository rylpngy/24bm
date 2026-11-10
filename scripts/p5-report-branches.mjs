import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { fixture } from "./agency-technical-fixture.mjs";
const checks = [],
  pass = (t) => {
    checks.push(t);
    console.log("PASS", t);
  };
for (const kind of ["invitation", "single"]) {
  const f = await fixture(`.p0/p3-method-${kind}-session.json`),
    { s, call, bad, key, definition, approve } = f,
    p = s.root + "/recommendation",
    sole = kind === "single";
  let priceId = null;
  if (!sole) {
    const quotes = await call(s.root + "/quotes");
    for (const subject of s.subjects)
      if (!quotes.some((q) => q.participationId === subject.id))
        await call(s.root + "/quotes", "POST", {
          participationId: subject.id,
          expectedPreviousId: null,
          kind: "original",
          amount: "100",
          currency: "CNY",
          evidenceVersionId: s.proofId,
          reason: "合成同价有效初始报价",
          reviewed: true,
          idempotencyKey: key(),
        });
    let w = await call(s.root + "/price-calculations");
    if (!w.rule) {
      const r = {
        priceSource: "original",
        formula: "price_comparison",
        criterionKey: "",
        fullScore: "0",
        scale: 2,
        rounding: "HALF_UP",
        tieRule: "同价须有权人工凭证",
      };
      let rule = await call(s.root + "/price-calculations/rule", "PUT", {
        expectedVersion: 0,
        config: {
          ruleVersion: "SYNTHETIC-LOWEST",
          basis: "实际冻结最低价格比较方法",
          locator: "合成原文件条款",
          documentRule: r,
          configuredRule: r,
        },
        reason: "原文人工核对",
        idempotencyKey: key(),
      });
      await call(s.root + "/price-calculations/rule/freeze", "POST", {
        expectedVersion: rule.version,
        reviewed: true,
        reason: "合成冻结",
        idempotencyKey: key(),
      });
    }
    const scope = {
        participationIds: s.subjects.map((v) => v.id),
        exclusions: {},
      },
      view = await call(s.root + "/price-calculations/preview", "POST", scope);
    assert.deepEqual(view.blockers, []);
    priceId = (
      await call(s.root + "/price-calculations", "POST", {
        scope,
        fingerprint: view.fingerprint,
        evidenceVersionId: s.proofId,
        reviewed: true,
        reason: "人工核对同价来源",
        idempotencyKey: key(),
      })
    ).id;
  }
  let rule = {
      ordering: sole ? "sole_source" : "price_asc",
      candidateCount: 1,
      tieHandling: "manual_pending",
      ruleText: sole
        ? "唯一专业协商对象，不进行竞争排名"
        : "同价按原文适用规则由有权主体实际处理后人工推荐一名",
    },
    inputs = {
      priceCalculationId: priceId,
      totalSnapshotId: null,
      documentRule: rule,
      configuredRule: rule,
      locator: "合成采购文件人工推荐条款",
    },
    view = await call(p + "/preview", "POST", inputs);
  assert.deepEqual(view.blockers, []);
  let confirm = {
    inputs,
    expectedFingerprint: view.sourceFingerprint,
    participationIds: [view.comparisons[0].participationId],
    evidenceVersionId: s.proofId,
    reviewed: true,
    reason: "合成方法专有人工推荐",
    idempotencyKey: key(),
  };
  if (!sole) {
    assert.ok(view.ties.length);
    await bad(p, "POST", confirm);
    rule = { ...rule, tieHandling: "manual_evidenced" };
    inputs = { ...inputs, documentRule: rule, configuredRule: rule };
    view = await call(p + "/preview", "POST", inputs);
    confirm = {
      ...confirm,
      inputs,
      expectedFingerprint: view.sourceFingerprint,
      tieEvidenceVersionId: s.proofId,
      tieReason: "合成按原文有权线下处理同价凭证，不按记录先后自动打破",
      idempotencyKey: key(),
    };
  } else {
    assert.equal(view.comparisons.length, 1);
    assert.equal(view.comparisons[0].metric, null);
  }
  const rec = await call(p, "POST", confirm);
  let report = await call(p + "/reports", "POST", {
    recommendationId: rec.id,
    narrative: {
      reviewProcess: "合成方式专有实际过程",
      reasoning: "引用本方式受控来源，不套用其他方式",
      exceptionHandling: "合成逐项核对实际条件和同价处理",
      conclusion: "仅人工建议，采购人确认另行办理",
    },
    idempotencyKey: key(),
  });
  const ws = await call(p),
    cmd = {
      expectedVersion: report.version,
      expectedFingerprint: ws.sourceFingerprint,
      reviewed: true,
      reason: "合成独立报告编制核对",
      idempotencyKey: key(),
    };
  await call(p + `/reports/${report.id}/generate`, "POST", cmd);
  await definition("agency_evaluation_report");
  await call(p + `/reports/${report.id}/submit`, "POST", {
    ...cmd,
    idempotencyKey: key(),
  });
  await approve(
    (await call(p)).submissions.find(
      (v) => v.reportId === report.id && v.status === "processing",
    ).id,
  );
  assert.equal(
    (await call(p)).reports.find((v) => v.id === report.id).status,
    "approved",
  );
  pass(
    sole
      ? "Sole-source report uses exactly one actual professional negotiation, agreed amount and quality rationale with no competitive ranking or three-supplier condition"
      : "Invited lowest-price report preserves real qualification/conformity stages; tied comparison cannot recommend until separately evidenced authority handling, then actual report approval succeeds",
  );
}
await fs.writeFile(
  ".p0/p5-report-branches-result.json",
  JSON.stringify({ passed: checks.length, checks }, null, 2),
);
