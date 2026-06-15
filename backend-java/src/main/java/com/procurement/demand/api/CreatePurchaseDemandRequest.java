package com.procurement.demand.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.List;

public record CreatePurchaseDemandRequest(
    @NotBlank String title,
    @NotBlank String departmentId,
    @Positive BigDecimal budget,
    @Valid @NotEmpty List<PurchaseDemandLineItemRequest> lineItems) {
}
