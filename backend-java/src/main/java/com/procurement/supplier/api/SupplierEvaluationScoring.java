package com.procurement.supplier.api;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Immutable scoring provenance; weights are percentages, not fractions. */
public record SupplierEvaluationScoring(String templateVersionId, String templateId,
    String templateName, int version, BigDecimal qualityWeight, BigDecimal deliveryWeight,
    BigDecimal priceWeight, BigDecimal serviceWeight) {
  public static SupplierEvaluationScoring legacy() {
    return new SupplierEvaluationScoring(null, null, "默认模板", 0,
        BigDecimal.valueOf(35), BigDecimal.valueOf(30), BigDecimal.valueOf(20), BigDecimal.valueOf(15));
  }

  public BigDecimal total(BigDecimal quality, BigDecimal delivery, BigDecimal price, BigDecimal service) {
    return quality.multiply(qualityWeight).add(delivery.multiply(deliveryWeight))
        .add(price.multiply(priceWeight)).add(service.multiply(serviceWeight))
        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
  }
}
