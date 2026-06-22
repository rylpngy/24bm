package com.procurement.finance.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record PaymentExecutionRecordResponse(
    String id,
    String tenantId,
    String paymentBatchNo,
    String paymentRequestId,
    String invoiceId,
    String supplierId,
    BigDecimal registeredAmount,
    LocalDate plannedPaymentDate,
    String executionStatus,
    String executionTrace,
    String executionBlockReason,
    String executionStage,
    String executionNextAction,
    String createdBy,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
