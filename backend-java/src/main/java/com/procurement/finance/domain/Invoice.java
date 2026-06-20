package com.procurement.finance.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record Invoice(
    String id,
    String tenantId,
    String supplierId,
    String orderId,
    BigDecimal amount,
    String invoiceNo,
    String paymentStatus,
    String reconciliationNote,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
