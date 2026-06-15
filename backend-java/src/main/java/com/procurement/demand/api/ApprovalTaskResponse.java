package com.procurement.demand.api;

import java.time.OffsetDateTime;

public record ApprovalTaskResponse(
    String id,
    String tenantId,
    String bizType,
    String bizId,
    String assigneeId,
    String status,
    OffsetDateTime createdAt) {
}
