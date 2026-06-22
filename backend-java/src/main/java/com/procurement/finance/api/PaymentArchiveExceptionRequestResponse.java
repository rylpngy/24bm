package com.procurement.finance.api;

import java.time.OffsetDateTime;

public record PaymentArchiveExceptionRequestResponse(
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
