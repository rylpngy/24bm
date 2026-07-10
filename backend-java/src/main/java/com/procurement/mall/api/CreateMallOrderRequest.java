package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateMallOrderRequest(
    @NotBlank String listingId,
    @NotNull BigDecimal quantity,
    LocalDate expectedReceiptDate) {
}
