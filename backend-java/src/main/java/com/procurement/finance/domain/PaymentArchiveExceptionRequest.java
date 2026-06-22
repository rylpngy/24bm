package com.procurement.finance.domain;

import java.time.OffsetDateTime;

public record PaymentArchiveExceptionRequest(
    String id,
    String tenantId,
    String paymentBatchNo,
    String exceptionType,
    String exceptionReason,
    String approvalStatus,
    String actionStatus,
    String actionResult,
    String closureStatus,
    String closureResult,
    String requestedBy,
    String reviewedBy,
    String handledBy,
    String closedBy,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
