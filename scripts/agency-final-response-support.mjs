// Synthetic regression fixture only: deliberately repeats known fixture numbers on the new final-response basis.
// Product code never copies initial scores or conclusions into final opinions.
export async function prepareFinalResponseReview({
  call,
  root,
  proofId,
  tokens,
}) {
  let w = await call(root + "/final-response-review");
  if (w.mode === "legacy") return;
  if (w.mode !== "active")
    await call(root + "/final-response-review/activate", "POST", {
      expectedVersion: w.plan?.version || 0,
      expectedFingerprint: w.fingerprint,
      evidenceVersionId: proofId,
      reviewed: true,
      reason: "合成最终需求和响应版本复核，不作实际采购规则",
      idempotencyKey: crypto.randomUUID(),
    });
  w = await call(root + "/final-response-review");
  for (const member of w.snapshot.members) {
    const token = tokens[member.userId];
    if (!token) throw Error("Synthetic reviewer token missing");
    let mine = await call(
      root + "/final-response-review/mine",
      "GET",
      undefined,
      token,
    );
    if (mine.sheet.status === "submitted") continue;
    const initial = await call(
        root + "/mine?stage=evaluation",
        "GET",
        undefined,
        token,
      ),
      original = JSON.parse(initial.sheets[0].entriesJson);
    if (initial.sheets[0].status !== "submitted") continue;
    const entries = mine.snapshot.subjects.flatMap((s) =>
      mine.snapshot.criteria.map((c) => ({
        participationId: s.participationId,
        criterionKey: c.key,
        score:
          c.resultType === "score"
            ? original.find(
                (e) =>
                  e.participationId === s.participationId &&
                  e.criterionKey === c.key,
              )?.score
            : null,
        conclusion: c.resultType === "score" ? null : "pass",
        evidence: "合成最终响应原文及共同需求逐项对照",
        opinion: "合成本人独立最终响应意见；数值为固定技术样例，不代表业务判断",
      })),
    );
    await call(
      root + "/final-response-review/mine",
      "PUT",
      {
        expectedVersion: mine.sheet.version,
        expectedFingerprint: mine.fingerprint,
        entries,
        idempotencyKey: crypto.randomUUID(),
      },
      token,
    );
    mine = await call(
      root + "/final-response-review/mine",
      "GET",
      undefined,
      token,
    );
    await call(
      root + "/final-response-review/mine/submit",
      "POST",
      {
        expectedVersion: mine.sheet.version,
        expectedFingerprint: mine.fingerprint,
        evidenceVersionId: proofId,
        personallyConfirmed: true,
        idempotencyKey: crypto.randomUUID(),
      },
      token,
    );
  }
}
