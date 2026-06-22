package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;

public record UpdatePaymentBlockResolutionStatusRequest(
    @NotBlank String resolutionStatus,
    String resolutionAction,
    String nextStep,
    String handledBy) {
}
