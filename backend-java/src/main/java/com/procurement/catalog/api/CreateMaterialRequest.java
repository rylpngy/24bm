package com.procurement.catalog.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

public record CreateMaterialRequest(
    @NotBlank String code,
    @NotBlank String name,
    @NotBlank String category,
    @NotBlank String unit,
    @PositiveOrZero BigDecimal referencePrice) {
}
