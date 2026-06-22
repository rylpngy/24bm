package com.procurement.finance.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record VarianceHandling(
    String id,
    String tenantId,
    String invoiceId,
    String supplierId,
    String orderId,
    BigDecimal varianceAmount,
    String reason,
    String ownerId,
    String result,
    String status,
    String createdBy,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
