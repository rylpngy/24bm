package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;

public record ClosePaymentArchiveExceptionRequestRequest(
    @NotBlank String closureResult) {
}
