package com.procurement.finance.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record InvoiceReconciliation(
    String id,
    String tenantId,
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
