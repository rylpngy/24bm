package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.supplier.domain.BuyerSupplierPerformanceScore;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class BuyerSupplierPerformanceScoreTests {
  @Test
  void acceptsScoresFromZeroToOneHundredInclusive() {
    assertThat(BuyerSupplierPerformanceScore.requireValid(BigDecimal.ZERO))
        .isEqualByComparingTo("0");
    assertThat(BuyerSupplierPerformanceScore.requireValid(BigDecimal.valueOf(96.50)))
        .isEqualByComparingTo("96.50");
    assertThat(BuyerSupplierPerformanceScore.requireValid(BigDecimal.valueOf(100)))
        .isEqualByComparingTo("100");
  }

  @Test
  void rejectsMissingNegativeAndAboveOneHundredScores() {
    assertThatThrownBy(() -> BuyerSupplierPerformanceScore.requireValid(null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Supplier performance score must be between 0 and 100");
    assertThatThrownBy(() -> BuyerSupplierPerformanceScore.requireValid(BigDecimal.valueOf(-1)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Supplier performance score must be between 0 and 100");
    assertThatThrownBy(() -> BuyerSupplierPerformanceScore.requireValid(BigDecimal.valueOf(100.01)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Supplier performance score must be between 0 and 100");
  }
}
