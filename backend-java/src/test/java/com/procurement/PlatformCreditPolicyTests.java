package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.platform.domain.SupplierCreditFacts;
import com.procurement.platform.domain.SupplierCreditPolicy;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

// 供应商信用评分规则(D-3):比率口径、无样本降级、加权与等级切分。
class PlatformCreditPolicyTests {

  private SupplierCreditFacts facts(long participated, long awarded, long orders, long completed,
      long onTime, long invoices, long clean) {
    return new SupplierCreditFacts("sup-1", "测试供应商", true,
        participated, awarded, orders, completed, onTime, invoices, clean, 1, BigDecimal.TEN);
  }

  @Test
  void rateReturnsNullWhenNoSample() {
    assertThat(SupplierCreditPolicy.rate(0, 0)).isNull();
    assertThat(SupplierCreditPolicy.rate(1, 4)).isEqualByComparingTo("25.00");
    assertThat(SupplierCreditPolicy.rate(2, 3)).isEqualByComparingTo("66.67");
  }

  @Test
  void unscoreableWithoutAnyParticipationOrOrder() {
    assertThat(SupplierCreditPolicy.scoreable(facts(0, 0, 0, 0, 0, 0, 0))).isFalse();
    assertThat(SupplierCreditPolicy.scoreable(facts(1, 0, 0, 0, 0, 0, 0))).isTrue();
    assertThat(SupplierCreditPolicy.scoreable(facts(0, 0, 1, 0, 0, 0, 0))).isTrue();
  }

  @Test
  void missingDimensionWeightsRedistribute() {
    // 仅有完成率(35%)与准时率(30%):加权均值 = (100*0.35 + 50*0.30) / 0.65
    BigDecimal score = SupplierCreditPolicy.creditScore(
        null, BigDecimal.valueOf(100), BigDecimal.valueOf(50), null);
    assertThat(score).isEqualByComparingTo("76.92");
    // 四项齐全:全 100 分即 100
    assertThat(SupplierCreditPolicy.creditScore(
        BigDecimal.valueOf(100), BigDecimal.valueOf(100), BigDecimal.valueOf(100), BigDecimal.valueOf(100)))
        .isEqualByComparingTo("100.00");
    // 全无样本 → null(不评分)
    assertThat(SupplierCreditPolicy.creditScore(null, null, null, null)).isNull();
  }

  @Test
  void creditLevelBoundaries() {
    assertThat(SupplierCreditPolicy.creditLevel(null)).isEqualTo("暂无评级");
    assertThat(SupplierCreditPolicy.creditLevel(BigDecimal.valueOf(90))).isEqualTo("AAA");
    assertThat(SupplierCreditPolicy.creditLevel(BigDecimal.valueOf(89.99))).isEqualTo("AA");
    assertThat(SupplierCreditPolicy.creditLevel(BigDecimal.valueOf(80))).isEqualTo("AA");
    assertThat(SupplierCreditPolicy.creditLevel(BigDecimal.valueOf(70))).isEqualTo("A");
    assertThat(SupplierCreditPolicy.creditLevel(BigDecimal.valueOf(60))).isEqualTo("B");
    assertThat(SupplierCreditPolicy.creditLevel(BigDecimal.valueOf(59.99))).isEqualTo("C");
  }
}
