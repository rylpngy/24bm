package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.DecimalMax;
import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateInvoiceRequest(
    @Positive BigDecimal amount,
    @NotBlank String invoiceNo,
    String invoiceCode,
    LocalDate invoiceDate,
    @DecimalMin("0") @DecimalMax("100") BigDecimal taxRate) {
}
