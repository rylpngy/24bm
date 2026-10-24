package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record CreateMallCartRequest(
    @NotEmpty @jakarta.validation.constraints.Size(max=200) List<@NotNull @jakarta.validation.Valid CartItem> items,
    LocalDate expectedReceiptDate,
    @NotBlank @jakarta.validation.constraints.Size(max=100) String idempotencyKey) {
  public CreateMallCartRequest(List<CartItem> items,LocalDate expectedReceiptDate) {
    this(items,expectedReceiptDate,null);
  }

  public record CartItem(@NotBlank String listingId, @NotNull BigDecimal quantity) {
  }
}
