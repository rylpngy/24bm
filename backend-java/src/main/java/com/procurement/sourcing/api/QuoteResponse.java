package com.procurement.sourcing.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record QuoteResponse(
    String id,
    String tenantId,
    String rfqId,
    String supplierId,
    BigDecimal amount,
    BigDecimal taxRate,
    Integer deliveryDays,
    String status,
    OffsetDateTime submittedAt,
    List<QuoteLineItemResponse> lineItems) {
}
