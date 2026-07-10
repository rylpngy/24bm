package com.procurement.mall.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record MallListing(
    String id,
    String tenantId,
    String supplierId,
    String supplierName,
    String materialId,
    String materialName,
    String materialCode,
    String category,
    String unit,
    BigDecimal price,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
