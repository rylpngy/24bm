package com.procurement.order.api;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record CreatePurchaseOrderRequest(
    @NotBlank String awardId,
    @FutureOrPresent LocalDate expectedReceiptDate) {
}
