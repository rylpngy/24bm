package com.procurement.finance.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record ThreeWayMatch(
    String id,
    String tenantId,
    String invoiceId,
    String supplierId,
    String orderId,
    BigDecimal orderAmount,
    String receiptStatus,
    BigDecimal invoiceAmount,
    BigDecimal varianceAmount,
    String matchStatus,
    String blockingReason,
    String paymentReadiness,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
