package com.procurement;

import com.procurement.tender.domain.TenderScoringWeights;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class TenderScoringWeightsTests {
  @Test void preservesLegacyCalculation() {
    assertThat(TenderScoringWeights.DEFAULT.composite(new BigDecimal("80"),new BigDecimal("90"),new BigDecimal("100"))).isEqualByComparingTo("88");
  }
  @Test void configuredWeightsChangeResultAndRoundOnce() {
    var weights=new TenderScoringWeights(new BigDecimal("10.25"),new BigDecimal("59.75"),new BigDecimal("30"));
    assertThat(weights.composite(new BigDecimal("10"),new BigDecimal("90"),new BigDecimal("100"))).isEqualByComparingTo("84.80");
    assertThat(weights.composite(null,BigDecimal.TEN,BigDecimal.TEN)).isNull();
  }
  @Test void rejectsInvalidSumRangePrecisionOrMissingWeights() {
    assertThatThrownBy(()->new TenderScoringWeights(BigDecimal.TEN,BigDecimal.TEN,BigDecimal.TEN)).hasMessageContaining("100%");
    assertThatThrownBy(()->new TenderScoringWeights(new BigDecimal("-1"),BigDecimal.ONE,new BigDecimal("100"))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->new TenderScoringWeights(new BigDecimal("50.001"),new BigDecimal("19.999"),new BigDecimal("30"))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(()->new TenderScoringWeights(null,BigDecimal.ONE,BigDecimal.ONE)).isInstanceOf(IllegalArgumentException.class);
  }
}
