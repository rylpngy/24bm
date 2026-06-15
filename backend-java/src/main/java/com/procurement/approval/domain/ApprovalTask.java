package com.procurement.approval.domain;

import java.time.OffsetDateTime;

public record ApprovalTask(
    String id,
    String tenantId,
    String bizType,
    String bizId,
    String assigneeId,
    String status,
    OffsetDateTime createdAt) {
}
