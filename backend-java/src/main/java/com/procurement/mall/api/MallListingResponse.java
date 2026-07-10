package com.procurement.mall.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record MallListingResponse(
    String id,
    String supplierId,
    String supplierName,
    String materialId,
    String materialName,
    String materialCode,
    String category,
    String unit,
    BigDecimal price,
    String status,
    OffsetDateTime updatedAt,
    String tenantId,
    String tenantName) {
}
