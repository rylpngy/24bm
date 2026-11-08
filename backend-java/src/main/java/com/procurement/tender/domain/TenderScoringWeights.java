package com.procurement.tender.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

public record TenderScoringWeights(BigDecimal technical, BigDecimal commercial, BigDecimal price) {
  public static final TenderScoringWeights DEFAULT = new TenderScoringWeights(new BigDecimal("50.00"), new BigDecimal("20.00"), new BigDecimal("30.00"));
  public TenderScoringWeights {
    for (var weight : new BigDecimal[]{technical, commercial, price}) {
      if (weight == null || weight.signum() < 0 || weight.compareTo(BigDecimal.valueOf(100)) > 0 || weight.stripTrailingZeros().scale() > 2)
        throw new IllegalArgumentException("评分权重须为0至100之间的数值，最多两位小数");
    }
    if (technical.add(commercial).add(price).compareTo(BigDecimal.valueOf(100)) != 0)
      throw new IllegalArgumentException("技术、商务、价格权重合计必须为100%");
  }
  public BigDecimal composite(BigDecimal technicalScore, BigDecimal commercialScore, BigDecimal priceScore) {
    if (technicalScore == null || commercialScore == null || priceScore == null) return null;
    return technicalScore.multiply(technical).add(commercialScore.multiply(commercial)).add(priceScore.multiply(price))
        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
  }
}
