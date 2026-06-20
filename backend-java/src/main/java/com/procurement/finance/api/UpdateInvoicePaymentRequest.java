package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;

public record UpdateInvoicePaymentRequest(
    @NotBlank String paymentStatus) {
}
