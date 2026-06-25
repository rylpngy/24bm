package com.procurement.finance.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record InvoiceResponse(
    String id,
    String tenantId,
    String supplierId,
    String orderId,
    BigDecimal amount,
    String invoiceNo,
    String paymentStatus,
    String reconciliationNote,
    LocalDate dueDate,
    boolean overdue,
    long overdueDays,
    BigDecimal orderAmount,
    BigDecimal varianceAmount,
    String receiptStatus,
    String reconciliationStatus,
    String reconciliationNo,
    String reconciliationStage,
    String nextReconciliationAction,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    String invoiceCode,
    LocalDate invoiceDate,
    BigDecimal taxRate,
    BigDecimal taxAmount,
    BigDecimal netAmount,
    Integer receivedQuantity,
    Integer qualifiedQuantity,
    Integer qualifiedRate,
    String quantityMatchStatus) {
}
