package com.procurement.catalog.api;

import java.math.BigDecimal;

public record MaterialResponse(
    String id,
    String tenantId,
    String code,
    String name,
    String category,
    String unit,
    BigDecimal referencePrice,
    String specification,
    String brand,
    BigDecimal taxRate,
    String description) {
}
