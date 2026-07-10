package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.supplier.domain.SupplierCooperationTier;
import com.procurement.supplier.domain.SupplierPerformanceScoring;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class SupplierPerformanceScoringTests {

  @Test
  void weightedTotalScoreIsRoundedToTwoDecimals() {
    // 质量95*0.35 + 交付90*0.30 + 价格80*0.20 + 服务85*0.15 = 33.25+27+16+12.75 = 89.00
    BigDecimal total = SupplierPerformanceScoring.totalScore(
        new BigDecimal("95"), new BigDecimal("90"), new BigDecimal("80"), new BigDecimal("85"));
    assertThat(total).isEqualByComparingTo("89.00");
  }

  @Test
  void totalScoreDrivesSuggestedTier() {
    assertThat(SupplierPerformanceScoring.suggestTier(new BigDecimal("92")))
        .isEqualTo(SupplierCooperationTier.PREFERRED);
    assertThat(SupplierPerformanceScoring.suggestTier(new BigDecimal("80")))
        .isEqualTo(SupplierCooperationTier.QUALIFIED);
    assertThat(SupplierPerformanceScoring.suggestTier(new BigDecimal("65")))
        .isEqualTo(SupplierCooperationTier.WATCH);
    assertThat(SupplierPerformanceScoring.suggestTier(new BigDecimal("50")))
        .isEqualTo(SupplierCooperationTier.ELIMINATED);
  }

  @Test
  void scoreOutOfRangeIsRejected() {
    assertThatThrownBy(
            () -> SupplierPerformanceScoring.requireValidScore(new BigDecimal("120"), "质量"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () -> SupplierPerformanceScoring.requireValidScore(new BigDecimal("-1"), "交付"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void invalidCooperationTierIsRejected() {
    assertThatThrownBy(() -> SupplierCooperationTier.requireValid("超级优选"))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
