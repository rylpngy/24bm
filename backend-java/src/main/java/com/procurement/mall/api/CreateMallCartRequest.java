package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record CreateMallCartRequest(
    @NotEmpty List<CartItem> items,
    LocalDate expectedReceiptDate) {

  public record CartItem(@NotBlank String listingId, @NotNull BigDecimal quantity) {
  }
}
