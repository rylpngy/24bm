package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;

public record UpdatePaymentBatchStatusRequest(
    @NotBlank String batchStatus) {
}
