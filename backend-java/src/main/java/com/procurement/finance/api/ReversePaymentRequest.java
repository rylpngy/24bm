package com.procurement.finance.api;

import jakarta.validation.constraints.*;

public record ReversePaymentRequest(@NotBlank @Size(max=100) String idempotencyKey,
    @NotBlank @Size(max=1000) String reason) {}
