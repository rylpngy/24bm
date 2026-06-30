package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.sourcing.domain.RfqMethod;
import org.junit.jupiter.api.Test;

// 采购方式法定家数:单一来源恰好 1 家,其余 ≥3 家。
class RfqMethodTests {

  @Test
  void singleSourceRequiresExactlyOneSupplier() {
    assertThatCode(() -> RfqMethod.requireSupplierCount(RfqMethod.SINGLE_SOURCE, 1))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> RfqMethod.requireSupplierCount(RfqMethod.SINGLE_SOURCE, 2))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("exactly one supplier");
  }

  @Test
  void competitiveMethodsRequireAtLeastThreeSuppliers() {
    assertThatCode(() -> RfqMethod.requireSupplierCount(RfqMethod.PUBLIC_TENDER, 3))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> RfqMethod.requireSupplierCount(RfqMethod.INQUIRY, 2))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("不少于3家");
  }

  @Test
  void negotiationRequiresAtLeastTwoRoundsToAward() {
    assertThatThrownBy(() -> RfqMethod.requireAwardEligible(RfqMethod.NEGOTIATION, 1, 3, "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("竞争性谈判须经至少一轮谈判");
    assertThatCode(() -> RfqMethod.requireAwardEligible(RfqMethod.NEGOTIATION, 2, 1, "rfq-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void competitiveMethodsRequireThreeBiddersToAward() {
    assertThatThrownBy(() -> RfqMethod.requireAwardEligible(RfqMethod.PUBLIC_TENDER, 1, 2, "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("不少于3家有效报价");
    assertThatCode(() -> RfqMethod.requireAwardEligible(RfqMethod.INQUIRY, 1, 3, "rfq-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void singleSourceAwardsWithOneBidder() {
    assertThatCode(() -> RfqMethod.requireAwardEligible(RfqMethod.SINGLE_SOURCE, 1, 1, "rfq-1"))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> RfqMethod.requireAwardEligible(RfqMethod.SINGLE_SOURCE, 1, 0, "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("单一来源须有 1 家报价");
  }

  @Test
  void defaultsToInquiryAndValidatesKnownMethods() {
    assertThat(RfqMethod.orDefault(null)).isEqualTo(RfqMethod.INQUIRY);
    assertThat(RfqMethod.orDefault("")).isEqualTo(RfqMethod.INQUIRY);
    assertThat(RfqMethod.isValid(RfqMethod.NEGOTIATION)).isTrue();
    assertThat(RfqMethod.isValid("拍脑袋")).isFalse();
    assertThat(RfqMethod.minSuppliers(RfqMethod.SINGLE_SOURCE)).isEqualTo(1);
    assertThat(RfqMethod.minSuppliers(RfqMethod.INVITED_TENDER)).isEqualTo(3);
  }
}
