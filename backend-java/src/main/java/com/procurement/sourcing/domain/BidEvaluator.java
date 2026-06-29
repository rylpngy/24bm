package com.procurement.sourcing.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;

// 加权评标(纯函数):价格分 = 最低价/本价 × 100;交期分 = 最短交期/本交期 × 100;
// 加权总分 = (价格权重×价格分 + 交期权重×交期分) / 权重和。按总分降序排名,rank=1 为推荐。
public final class BidEvaluator {

  public record ScoredQuote(
      Quote quote,
      BigDecimal priceScore,
      BigDecimal deliveryScore,
      BigDecimal weightedScore,
      int rank) {}

  private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

  private BidEvaluator() {}

  public static List<ScoredQuote> evaluate(List<Quote> quotes, int priceWeight, int deliveryWeight) {
    if (priceWeight < 0 || deliveryWeight < 0 || priceWeight + deliveryWeight == 0) {
      throw new IllegalArgumentException("权重必须非负且不能同时为 0");
    }
    if (quotes == null || quotes.isEmpty()) {
      return List.of();
    }
    BigDecimal minAmount = quotes.stream()
        .map(Quote::amount)
        .filter(a -> a != null && a.signum() > 0)
        .min(Comparator.naturalOrder())
        .orElse(null);
    int minDays = quotes.stream()
        .map(Quote::deliveryDays)
        .filter(d -> d != null && d > 0)
        .min(Comparator.naturalOrder())
        .orElse(0);
    BigDecimal weightSum = BigDecimal.valueOf((long) priceWeight + deliveryWeight);

    List<ScoredQuote> scored = quotes.stream()
        .map(q -> {
          BigDecimal priceScore = scoreLowerBetter(minAmount, q.amount());
          BigDecimal deliveryScore = scoreLowerBetter(
              minDays > 0 ? BigDecimal.valueOf(minDays) : null,
              q.deliveryDays() != null ? BigDecimal.valueOf(q.deliveryDays()) : null);
          BigDecimal weighted = priceScore.multiply(BigDecimal.valueOf(priceWeight))
              .add(deliveryScore.multiply(BigDecimal.valueOf(deliveryWeight)))
              .divide(weightSum, 2, RoundingMode.HALF_UP);
          return new ScoredQuote(q, priceScore, deliveryScore, weighted, 0);
        })
        .sorted(Comparator.comparing(ScoredQuote::weightedScore).reversed()
            .thenComparing(s -> s.quote().amount()))
        .toList();

    return java.util.stream.IntStream.range(0, scored.size())
        .mapToObj(i -> {
          ScoredQuote s = scored.get(i);
          return new ScoredQuote(s.quote(), s.priceScore(), s.deliveryScore(), s.weightedScore(), i + 1);
        })
        .toList();
  }

  // 越低越优:best/value × 100。缺失或非正值记 0 分。
  private static BigDecimal scoreLowerBetter(BigDecimal best, BigDecimal value) {
    if (best == null || value == null || value.signum() <= 0) {
      return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
    return best.multiply(HUNDRED).divide(value, 2, RoundingMode.HALF_UP);
  }
}
