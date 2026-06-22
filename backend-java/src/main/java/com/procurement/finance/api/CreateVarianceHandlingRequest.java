package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;

public record CreateVarianceHandlingRequest(
    @NotBlank String invoiceId,
    @NotBlank String reason,
    @NotBlank String ownerId,
    @NotBlank String result,
    @NotBlank String status) {
}
