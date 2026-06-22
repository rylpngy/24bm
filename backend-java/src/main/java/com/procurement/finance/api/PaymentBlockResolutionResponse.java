package com.procurement.finance.api;

import java.time.OffsetDateTime;

public record PaymentBlockResolutionResponse(
    String id,
    String tenantId,
    String paymentBatchNo,
    String paymentRequestId,
    String invoiceId,
    String supplierId,
    String blockReason,
    String resolutionStatus,
    String resolutionAction,
    String nextStep,
    String handledBy,
    String createdBy,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
