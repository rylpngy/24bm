package com.procurement.platform.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 供应商信用评分规则(D-3):
 * - 四项行为指标加权:中标率 20% + 订单完成率 35% + 准时交付率 30% + 对账通过率 15%;
 * - 某项无样本(分母为 0)时,该项权重按剩余项等比重分配,不按 0 分计;
 * - 完全无履约样本(既无参与也无订单)时不评分,由前端显示「暂无履约数据」,
 *   避免新入驻供应商被"零数据满分/零分"误导。
 */
public final class SupplierCreditPolicy {

  private static final BigDecimal W_WIN = new BigDecimal("0.20");
  private static final BigDecimal W_COMPLETION = new BigDecimal("0.35");
  private static final BigDecimal W_ON_TIME = new BigDecimal("0.30");
  private static final BigDecimal W_RECONCILIATION = new BigDecimal("0.15");
  private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

  private SupplierCreditPolicy() {}

  /** 比率(0~100),分母为 0 返回 null 表示无样本。 */
  public static BigDecimal rate(long numerator, long denominator) {
    if (denominator <= 0) return null;
    return BigDecimal.valueOf(numerator)
        .multiply(HUNDRED)
        .divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP);
  }

  public static boolean scoreable(SupplierCreditFacts f) {
    return f.participatedProjects() > 0 || f.orderCount() > 0;
  }

  /** 加权信用分(0~100,两位小数);无样本返回 null。 */
  public static BigDecimal creditScore(
      BigDecimal winRate, BigDecimal completionRate, BigDecimal onTimeRate, BigDecimal reconciliationRate) {
    BigDecimal weighted = BigDecimal.ZERO;
    BigDecimal usedWeight = BigDecimal.ZERO;
    if (winRate != null) {
      weighted = weighted.add(winRate.multiply(W_WIN));
      usedWeight = usedWeight.add(W_WIN);
    }
    if (completionRate != null) {
      weighted = weighted.add(completionRate.multiply(W_COMPLETION));
      usedWeight = usedWeight.add(W_COMPLETION);
    }
    if (onTimeRate != null) {
      weighted = weighted.add(onTimeRate.multiply(W_ON_TIME));
      usedWeight = usedWeight.add(W_ON_TIME);
    }
    if (reconciliationRate != null) {
      weighted = weighted.add(reconciliationRate.multiply(W_RECONCILIATION));
      usedWeight = usedWeight.add(W_RECONCILIATION);
    }
    if (usedWeight.signum() == 0) return null;
    return weighted.divide(usedWeight, 2, RoundingMode.HALF_UP);
  }

  /** 信用等级:AAA ≥90 / AA ≥80 / A ≥70 / B ≥60 / C <60;无分为「暂无评级」。 */
  public static String creditLevel(BigDecimal score) {
    if (score == null) return "暂无评级";
    if (score.compareTo(BigDecimal.valueOf(90)) >= 0) return "AAA";
    if (score.compareTo(BigDecimal.valueOf(80)) >= 0) return "AA";
    if (score.compareTo(BigDecimal.valueOf(70)) >= 0) return "A";
    if (score.compareTo(BigDecimal.valueOf(60)) >= 0) return "B";
    return "C";
  }
}
