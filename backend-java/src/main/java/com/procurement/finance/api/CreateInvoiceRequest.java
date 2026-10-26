package com.procurement.finance.api;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateInvoiceRequest(
    @Positive BigDecimal amount,
    @NotBlank String invoiceNo,
    String invoiceCode,
    LocalDate invoiceDate,
    @DecimalMin("0") @DecimalMax("100") BigDecimal taxRate,
    @jakarta.validation.constraints.Size(max = 100) String requestKey,
    @jakarta.validation.constraints.Size(min = 1, max = 200)
        java.util.List<@jakarta.validation.Valid Line> lineItems) {
  public CreateInvoiceRequest(
      BigDecimal amount,
      String invoiceNo,
      String invoiceCode,
      LocalDate invoiceDate,
      BigDecimal taxRate) {
    this(amount, invoiceNo, invoiceCode, invoiceDate, taxRate, null, null);
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "InvoiceIssuanceLine")
  public record Line(
      @NotBlank String orderLineId,
      @jakarta.validation.constraints.NotNull
          @Positive
          @jakarta.validation.constraints.Digits(integer = 14, fraction = 4)
          BigDecimal quantity) {}
}
