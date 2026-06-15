package com.procurement.approval.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record PendingApprovalTaskResponse(
    String id,
    String tenantId,
    String bizType,
    String bizId,
    String parentBizId,
    String summaryTitle,
    String businessStatus,
    BigDecimal amount,
    String counterpartyId,
    String counterpartyName,
    String assigneeId,
    String status,
    OffsetDateTime createdAt) {
}
