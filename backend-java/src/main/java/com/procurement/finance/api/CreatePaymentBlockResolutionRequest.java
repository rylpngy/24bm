package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;

public record CreatePaymentBlockResolutionRequest(
    @NotBlank String paymentBatchNo,
    String paymentRequestId,
    String invoiceId,
    String supplierId,
    @NotBlank String blockReason,
    @NotBlank String resolutionStatus,
    @NotBlank String resolutionAction,
    @NotBlank String nextStep,
    String handledBy) {
}
