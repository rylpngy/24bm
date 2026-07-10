package com.procurement.mall.domain;

import java.math.BigDecimal;

public record SupplierMallMaterial(
    String tenantId,
    String tenantName,
    String materialId,
    String name,
    String code,
    String category,
    String unit,
    BigDecimal referencePrice) {
}
