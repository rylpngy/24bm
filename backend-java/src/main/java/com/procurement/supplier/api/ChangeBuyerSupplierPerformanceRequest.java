package com.procurement.supplier.api;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record ChangeBuyerSupplierPerformanceRequest(
    @NotNull
    @DecimalMin("0.00")
    @DecimalMax("100.00")
    BigDecimal performanceScore) {
}
