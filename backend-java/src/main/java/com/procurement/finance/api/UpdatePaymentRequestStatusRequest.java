package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;

public record UpdatePaymentRequestStatusRequest(
    @NotBlank String requestStatus) {
}
