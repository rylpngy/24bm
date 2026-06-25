package com.procurement.platform.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record BillingStatement(
    String id,
    String tenantId,
    String period,
    String planCode,
    BigDecimal basePrice,
    BigDecimal overageTotal,
    BigDecimal totalAmount,
    String status,
    OffsetDateTime generatedAt,
    OffsetDateTime issuedAt,
    OffsetDateTime paidAt) {
}
