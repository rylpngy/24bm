package com.procurement.supplier.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** 供应商绩效考核单（一租户一供应商一周期唯一）。 */
public record SupplierEvaluation(
    String id,
    String tenantId,
    String supplierId,
    String period,
    BigDecimal qualityScore,
    BigDecimal deliveryScore,
    BigDecimal priceScore,
    BigDecimal serviceScore,
    BigDecimal totalScore,
    String suggestedTier,
    String comment,
    String evaluatedBy,
    OffsetDateTime createdAt) {
}
