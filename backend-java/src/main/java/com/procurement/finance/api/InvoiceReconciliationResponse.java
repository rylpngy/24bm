package com.procurement.finance.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record InvoiceReconciliationResponse(
    String id,
    String tenantId,
    String reconciliationNo,
    String invoiceId,
    String supplierId,
    String orderId,
    String stage,
    String nextAction,
    BigDecimal orderAmount,
    BigDecimal invoiceAmount,
    BigDecimal varianceAmount,
    String receiptStatus,
    String paymentStatus,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
