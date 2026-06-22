package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;

public record CompletePaymentArchiveExceptionActionRequest(
    @NotBlank String actionResult) {
}
