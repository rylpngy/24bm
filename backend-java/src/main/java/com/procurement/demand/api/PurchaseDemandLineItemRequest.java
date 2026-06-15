package com.procurement.demand.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record PurchaseDemandLineItemRequest(
    @NotBlank String materialId,
    @Positive BigDecimal quantity) {
}
