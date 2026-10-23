package com.procurement.finance.api;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record PaymentReviewNoteRequest(
    @NotBlank @Size(max = 100) String idempotencyKey,
    @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal reportedPaidAmount,
    @NotBlank @Size(max = 500) String evidenceReference,
    @NotBlank @Size(max = 2000) String explanation) {}
