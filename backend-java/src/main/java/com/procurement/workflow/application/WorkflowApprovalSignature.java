package com.procurement.workflow.application;

import java.time.OffsetDateTime;

/** 供业务归档文档使用的线上审批签名摘要。 */
public record WorkflowApprovalSignature(
    String nodeId,
    String actorName,
    OffsetDateTime actedAt) {
}
