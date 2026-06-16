package com.procurement.supplier.domain;

import java.math.BigDecimal;

public final class BuyerSupplierPerformanceScore {
  private static final BigDecimal MINIMUM = BigDecimal.ZERO;
  private static final BigDecimal MAXIMUM = BigDecimal.valueOf(100);

  private BuyerSupplierPerformanceScore() {}

  public static BigDecimal requireValid(BigDecimal performanceScore) {
    if (performanceScore == null
        || performanceScore.compareTo(MINIMUM) < 0
        || performanceScore.compareTo(MAXIMUM) > 0) {
      throw new IllegalArgumentException("Supplier performance score must be between 0 and 100.");
    }
    return performanceScore;
  }
}
