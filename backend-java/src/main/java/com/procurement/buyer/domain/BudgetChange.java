package com.procurement.buyer.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record BudgetChange(String id, String tenantId, String departmentId, String period, String kind,
    BigDecimal targetAmount, BigDecimal baseAmount, long baseVersion, long revision, String targetType, String targetId,
    String title, String reason, String status, String createdBy, String workflowInstanceId, String approvedBy,
    OffsetDateTime approvedAt, OffsetDateTime expiresAt, String consumedBy, OffsetDateTime consumedAt,
    OffsetDateTime createdAt, OffsetDateTime updatedAt, Long consumedTransaction) {}
