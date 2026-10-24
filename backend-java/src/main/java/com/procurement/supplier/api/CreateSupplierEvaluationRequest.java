package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CreateSupplierEvaluationRequest(
    @NotBlank String period,
    @NotNull BigDecimal qualityScore,
    @NotNull BigDecimal deliveryScore,
    @NotNull BigDecimal priceScore,
    @NotNull BigDecimal serviceScore,
    String comment,
    String templateVersionId) {
  public CreateSupplierEvaluationRequest(String period, BigDecimal qualityScore, BigDecimal deliveryScore,
      BigDecimal priceScore, BigDecimal serviceScore, String comment) {
    this(period, qualityScore, deliveryScore, priceScore, serviceScore, comment, null);
  }
}
