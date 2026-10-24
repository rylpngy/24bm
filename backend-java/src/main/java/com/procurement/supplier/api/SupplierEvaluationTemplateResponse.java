package com.procurement.supplier.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record SupplierEvaluationTemplateResponse(String id, String templateId, String name,
    int version, BigDecimal qualityWeight, BigDecimal deliveryWeight, BigDecimal priceWeight,
    BigDecimal serviceWeight, boolean enabled, OffsetDateTime createdAt) {
  public SupplierEvaluationScoring scoring() {
    return new SupplierEvaluationScoring(id, templateId, name, version,
        qualityWeight, deliveryWeight, priceWeight, serviceWeight);
  }
}
