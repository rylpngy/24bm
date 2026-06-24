package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateInvoiceRequest(
    @Positive BigDecimal amount,
    @NotBlank String invoiceNo,
    String invoiceCode,
    LocalDate invoiceDate,
    BigDecimal taxRate) {
}
