package com.procurement.supplier.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record SupplierEvaluationResponse(
    String id,
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
    OffsetDateTime createdAt,
    SupplierEvaluationScoring scoring) {
  public SupplierEvaluationResponse(String id, String supplierId, String period,
      BigDecimal qualityScore, BigDecimal deliveryScore, BigDecimal priceScore, BigDecimal serviceScore,
      BigDecimal totalScore, String suggestedTier, String comment, String evaluatedBy, OffsetDateTime createdAt) {
    this(id, supplierId, period, qualityScore, deliveryScore, priceScore, serviceScore,
        totalScore, suggestedTier, comment, evaluatedBy, createdAt, SupplierEvaluationScoring.legacy());
  }
}
