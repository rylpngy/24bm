package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.sourcing.domain.BidEvaluator;
import com.procurement.sourcing.domain.Quote;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

// 加权评标纯函数:最低价/最短交期得满分,加权排名,rank=1 为推荐。
class BidEvaluatorTests {

  private Quote quote(String id, String supplier, double amount, int days) {
    return new Quote(id, "tenant-1", "rfq-1", supplier,
        BigDecimal.valueOf(amount), BigDecimal.valueOf(13), days, "已提交",
        OffsetDateTime.parse("2026-06-20T10:00:00+08:00"));
  }

  @Test
  void lowestPriceAndShortestDeliveryWinsWithFullScores() {
    var scored = BidEvaluator.evaluate(List.of(
        quote("q-a", "sup-a", 118000, 7),
        quote("q-b", "sup-b", 125000, 10)), 70, 30);

    assertThat(scored).hasSize(2);
    var top = scored.get(0);
    assertThat(top.quote().id()).isEqualTo("q-a");
    assertThat(top.rank()).isEqualTo(1);
    assertThat(top.priceScore()).isEqualByComparingTo("100.00");
    assertThat(top.deliveryScore()).isEqualByComparingTo("100.00");
    assertThat(top.weightedScore()).isEqualByComparingTo("100.00");

    var second = scored.get(1);
    assertThat(second.quote().id()).isEqualTo("q-b");
    assertThat(second.rank()).isEqualTo(2);
    // price 118000/125000*100=94.40; delivery 7/10*100=70; weighted (70*94.40+30*70)/100=87.08
    assertThat(second.weightedScore()).isEqualByComparingTo("87.08");
  }

  @Test
  void weightShiftToDeliveryCanFlipRanking() {
    // 交期权重占主导:更快交期的 q-b 反超低价的 q-a。
    var scored = BidEvaluator.evaluate(List.of(
        quote("q-a", "sup-a", 100000, 30),
        quote("q-b", "sup-b", 110000, 5)), 10, 90);

    assertThat(scored.get(0).quote().id()).isEqualTo("q-b");
  }

  @Test
  void emptyQuotesYieldEmptyResult() {
    assertThat(BidEvaluator.evaluate(List.of(), 70, 30)).isEmpty();
  }

  @Test
  void zeroTotalWeightIsRejected() {
    assertThatThrownBy(() -> BidEvaluator.evaluate(List.of(quote("q", "s", 1, 1)), 0, 0))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
