package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateMallOrderRequest(
    @NotBlank String listingId,
    @NotNull BigDecimal quantity,
    LocalDate expectedReceiptDate,
    @NotBlank @jakarta.validation.constraints.Size(max=100) String idempotencyKey) {
  public CreateMallOrderRequest(String listingId,BigDecimal quantity,LocalDate expectedReceiptDate) {
    this(listingId,quantity,expectedReceiptDate,null);
  }
}
