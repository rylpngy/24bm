package com.procurement.finance.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record InvoiceResponse(
    String id,
    String tenantId,
    String supplierId,
    String orderId,
    BigDecimal amount,
    String invoiceNo,
    String paymentStatus,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
