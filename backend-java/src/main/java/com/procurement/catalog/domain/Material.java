package com.procurement.catalog.domain;

import java.math.BigDecimal;

public record Material(
    String id,
    String tenantId,
    String code,
    String name,
    String category,
    String unit,
    BigDecimal referencePrice,
    String specification,
    String brand,
    boolean governmentMallCatalog,
    BigDecimal taxRate,
    String description) {
}
