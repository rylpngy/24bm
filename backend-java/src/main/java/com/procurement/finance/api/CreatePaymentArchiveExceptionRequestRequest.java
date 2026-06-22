package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;

public record CreatePaymentArchiveExceptionRequestRequest(
    @NotBlank String paymentBatchNo,
    @NotBlank String exceptionType,
    @NotBlank String exceptionReason) {
}
