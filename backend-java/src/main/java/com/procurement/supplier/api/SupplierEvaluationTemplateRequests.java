package com.procurement.supplier.api;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public final class SupplierEvaluationTemplateRequests {
  private SupplierEvaluationTemplateRequests() {}

  public record Definition(@NotBlank @Size(max = 200) String name,
      @NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal qualityWeight,
      @NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal deliveryWeight,
      @NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal priceWeight,
      @NotNull @DecimalMin("0") @DecimalMax("100") BigDecimal serviceWeight) {
    public void validate() {
      if (name == null || name.isBlank() || name.strip().length() > 200) {
        throw new IllegalArgumentException("模板名称不能为空且不得超过200字");
      }
      BigDecimal total = BigDecimal.ZERO;
      for (BigDecimal weight : new BigDecimal[] {qualityWeight, deliveryWeight, priceWeight, serviceWeight}) {
        if (weight == null || weight.signum() < 0 || weight.compareTo(BigDecimal.valueOf(100)) > 0) {
          throw new IllegalArgumentException("各维度权重必须在0到100之间");
        }
        total = total.add(weight);
      }
      if (total.compareTo(BigDecimal.valueOf(100)) != 0) {
        throw new IllegalArgumentException("四维权重合计必须为100");
      }
    }
  }

  public record Enabled(@NotNull Boolean enabled) {}
}
