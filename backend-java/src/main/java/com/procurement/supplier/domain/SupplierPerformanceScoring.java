package com.procurement.supplier.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * SRM 绩效评分规则：四维加权综合分 + 综合分驱动的生命周期标记建议。
 * 权重与阈值为 MVP 默认值，后续可按租户配置化。
 */
public final class SupplierPerformanceScoring {

  public static final BigDecimal QUALITY_WEIGHT = new BigDecimal("0.35");
  public static final BigDecimal DELIVERY_WEIGHT = new BigDecimal("0.30");
  public static final BigDecimal PRICE_WEIGHT = new BigDecimal("0.20");
  public static final BigDecimal SERVICE_WEIGHT = new BigDecimal("0.15");

  private SupplierPerformanceScoring() {}

  /** 综合分 = Σ(维度分 × 权重)，保留两位。 */
  public static BigDecimal totalScore(
      BigDecimal quality, BigDecimal delivery, BigDecimal price, BigDecimal service) {
    return quality.multiply(QUALITY_WEIGHT)
        .add(delivery.multiply(DELIVERY_WEIGHT))
        .add(price.multiply(PRICE_WEIGHT))
        .add(service.multiply(SERVICE_WEIGHT))
        .setScale(2, RoundingMode.HALF_UP);
  }

  /** 综合分 → 建议生命周期标记。 */
  public static String suggestTier(BigDecimal totalScore) {
    if (totalScore.compareTo(new BigDecimal("90")) >= 0) {
      return SupplierCooperationTier.PREFERRED;
    }
    if (totalScore.compareTo(new BigDecimal("75")) >= 0) {
      return SupplierCooperationTier.QUALIFIED;
    }
    if (totalScore.compareTo(new BigDecimal("60")) >= 0) {
      return SupplierCooperationTier.WATCH;
    }
    return SupplierCooperationTier.ELIMINATED;
  }

  /** 每个维度分必须在 0–100。 */
  public static void requireValidScore(BigDecimal score, String dimension) {
    if (score == null
        || score.compareTo(BigDecimal.ZERO) < 0
        || score.compareTo(new BigDecimal("100")) > 0) {
      throw new IllegalArgumentException(dimension + " 评分必须在 0–100 之间");
    }
  }
}
