package com.procurement.mall.api;

import java.math.BigDecimal;

public record SupplierMallMaterialResponse(
    String tenantId,
    String tenantName,
    String materialId,
    String name,
    String code,
    String category,
    String unit,
    BigDecimal referencePrice) {
}
