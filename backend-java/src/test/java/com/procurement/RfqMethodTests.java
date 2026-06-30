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
  void defaultsToInquiryAndValidatesKnownMethods() {
    assertThat(RfqMethod.orDefault(null)).isEqualTo(RfqMethod.INQUIRY);
    assertThat(RfqMethod.orDefault("")).isEqualTo(RfqMethod.INQUIRY);
    assertThat(RfqMethod.isValid(RfqMethod.NEGOTIATION)).isTrue();
    assertThat(RfqMethod.isValid("拍脑袋")).isFalse();
    assertThat(RfqMethod.minSuppliers(RfqMethod.SINGLE_SOURCE)).isEqualTo(1);
    assertThat(RfqMethod.minSuppliers(RfqMethod.INVITED_TENDER)).isEqualTo(3);
  }
}
