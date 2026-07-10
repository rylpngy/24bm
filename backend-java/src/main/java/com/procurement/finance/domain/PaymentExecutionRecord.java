package com.procurement.finance.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record PaymentExecutionRecord(
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
    String releaseEvidenceNo,
    String releaseRemark,
    String createdBy,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
