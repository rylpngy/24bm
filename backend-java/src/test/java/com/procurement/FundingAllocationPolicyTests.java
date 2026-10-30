package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.buyer.domain.FundingAllocationPolicy;
import com.procurement.buyer.domain.FundingAllocationPolicy.Share;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class FundingAllocationPolicyTests {
  @Test
  void keepsExplicitAmountsAndSortsForStableReconciliation() {
    assertThat(
            FundingAllocationPolicy.requireTotal(
                List.of(
                    new Share("b", new BigDecimal("0.20")), new Share("a", new BigDecimal("0.10"))),
                new BigDecimal("0.30")))
        .extracting(Share::fundId)
        .containsExactly("a", "b");
  }

  @Test
  void requiresExactTotal() {
    assertThatThrownBy(
            () ->
                FundingAllocationPolicy.requireTotal(
                    List.of(new Share("a", BigDecimal.ONE)), new BigDecimal("2")))
        .hasMessageContaining("合计");
  }

  @Test
  void rejectsDuplicateSourceAndInvalidAmounts() {
    for (var lines :
        List.of(
            List.of(new Share("a", BigDecimal.ONE), new Share("a", BigDecimal.ONE)),
            List.of(new Share("a", BigDecimal.ZERO)),
            List.of(new Share("a", new BigDecimal("0.001")))))
      assertThatThrownBy(() -> FundingAllocationPolicy.requireTotal(lines, BigDecimal.ONE))
          .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void requiresAtLeastOneExplicitSource() {
    assertThatThrownBy(() -> FundingAllocationPolicy.requireTotal(List.of(), BigDecimal.ONE))
        .hasMessageContaining("明确");
  }
}
