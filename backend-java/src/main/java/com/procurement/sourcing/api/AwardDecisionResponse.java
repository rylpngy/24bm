package com.procurement.sourcing.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record AwardDecisionResponse(
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
