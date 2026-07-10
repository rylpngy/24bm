package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record SupplierPublishMallListingRequest(
    @NotBlank String tenantId,
    @NotBlank String materialId,
    @NotNull BigDecimal price,
    String unit) {
}
