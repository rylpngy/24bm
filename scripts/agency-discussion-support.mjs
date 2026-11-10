import assert from "node:assert/strict";
// Synthetic half-process fixture: no supplier login, electronic signature, message sending or requirement change.
export async function prepareSupplierDiscussions({
  call,
  root,
  proofId,
  participantIds,
}) {
  let w = await call(root + "/discussions");
  if (w.mode !== "active") {
    await call(root + "/discussions/activate", "POST", {
      expectedVersion: w.plan?.version || 0,
      evidenceVersionId: proofId,
      reviewed: true,
      reason: "合成逐家沟通范围核对，不作实际采购依据",
      idempotencyKey: crypto.randomUUID(),
    });
    w = await call(root + "/discussions");
  }
  for (const id of participantIds) {
    let ledger = await call(root + "/discussions/" + id);
    if (ledger.records.some((r) => r.status === "confirmed")) continue;
    const draft = ledger.records.find((r) => r.status === "draft");
    const content = {
      startedAt: w.openedAt,
      endedAt: w.openedAt,
      staffUserIds: [w.plan.createdBy],
      supplierAttendees: "合成供应商代表；身份仅为线下登记，不代表在线认证",
      agenda: "合成沟通议题",
      discussion:
        "合成边界验证：实际时点采用开启时点，不代表真实会谈或业务规则",
      supplierResponse: "合成回应，无需求调整",
      conclusion: "合成过程已核对，不代替实质响应判断",
      changeDisposition: "none",
      changeNote: "",
      evidenceVersionId: proofId,
    };
    const row = await call(root + "/discussions/" + id + "/draft", "PUT", {
      recordId: draft?.id || null,
      expectedVersion: draft?.version || 0,
      content,
      reason: "合成逐家过程技术验证",
      idempotencyKey: crypto.randomUUID(),
    });
    w = await call(root + "/discussions");
    await call(
      root + "/discussions/" + id + "/" + row.id + "/confirm",
      "POST",
      {
        expectedVersion: row.version,
        expectedPreviousId: row.previousId,
        supplierConfirmationVersionId: proofId,
        supplierConfirmationNote:
          "合成线下确认材料，非真实签署或供应商在线身份",
        reviewed: true,
        expectedFingerprint: w.fingerprint,
        idempotencyKey: crypto.randomUUID(),
      },
    );
  }
  w = await call(root + "/discussions");
  assert.equal(w.mode, "active");
  return w.fingerprint;
}
