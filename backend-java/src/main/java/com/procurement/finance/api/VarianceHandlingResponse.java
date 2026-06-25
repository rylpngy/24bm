package com.procurement.finance.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record VarianceHandlingResponse(
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
    OffsetDateTime updatedAt,
    String orderLineId,
    String lineDescription) {
}
