package com.procurement.sourcing.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record AwardDecision(
    String id,
    String tenantId,
    String rfqId,
    String quoteId,
    String supplierId,
    BigDecimal amount,
    String reason,
    String approvedStatus,
    OffsetDateTime createdAt) {
}
