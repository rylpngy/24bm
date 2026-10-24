package com.procurement.order.api;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record CreatePurchaseOrderRequest(
    @NotBlank String awardId,
    @NotNull @FutureOrPresent LocalDate expectedReceiptDate) {
}
