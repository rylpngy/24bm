package com.procurement.finance.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record PaymentBatchResponse(
    String id,
    String tenantId,
    String paymentBatchNo,
    String supplierId,
    Integer requestCount,
    BigDecimal totalAmount,
    BigDecimal approvedAmount,
    BigDecimal registeredAmount,
    BigDecimal pendingRegistrationAmount,
    BigDecimal blockedRegistrationAmount,
    Integer registeredCount,
    Integer pendingRegistrationCount,
    Integer blockedRegistrationCount,
    String executionDecision,
    String executionBlockSummary,
    String batchStatus,
    LocalDate plannedPaymentDate,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
