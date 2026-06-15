package com.procurement.sourcing.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record Quote(
    String id,
    String tenantId,
    String rfqId,
    String supplierId,
    BigDecimal amount,
    BigDecimal taxRate,
    Integer deliveryDays,
    String status,
    OffsetDateTime submittedAt) {
}
