package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.sourcing.domain.RfqMethod;
import org.junit.jupiter.api.Test;

// 1.0 采购方式:询比、竞价、商城、单一来源;旧招标类方式仅做兼容映射。
class RfqMethodTests {

  @Test
  void compareAndAuctionRequireAtLeastThreeSuppliersWhenSpecified() {
    assertThatCode(() -> RfqMethod.requireSupplierCount(RfqMethod.COMPARE, 3))
        .doesNotThrowAnyException();
    assertThatCode(() -> RfqMethod.requireSupplierCount(RfqMethod.AUCTION, 3))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> RfqMethod.requireSupplierCount(RfqMethod.COMPARE, 2))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("不少于3家");
  }

  @Test
  void mallDoesNotRequireInvitedSuppliers() {
    assertThatCode(() -> RfqMethod.requireSupplierCount(RfqMethod.MALL, 0))
        .doesNotThrowAnyException();
    assertThatCode(() -> RfqMethod.requireAwardEligible(RfqMethod.MALL, 1, 0, "rfq-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void singleSourceRequiresExactlyOneSupplierAndOneBidder() {
    assertThatCode(() -> RfqMethod.requireSupplierCount(RfqMethod.SINGLE_SOURCE, 1))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> RfqMethod.requireSupplierCount(RfqMethod.SINGLE_SOURCE, 0))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("仅须邀请 1 家");
    assertThatThrownBy(() -> RfqMethod.requireSupplierCount(RfqMethod.SINGLE_SOURCE, 2))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("仅须邀请 1 家");
    assertThatCode(() -> RfqMethod.requireAwardEligible(RfqMethod.SINGLE_SOURCE, 1, 1, "rfq-1"))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> RfqMethod.requireAwardEligible(RfqMethod.SINGLE_SOURCE, 1, 0, "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("单一来源须有 1 家报价");
  }

  @Test
  void compareAndAuctionRequireThreeBiddersToAward() {
    assertThatThrownBy(() -> RfqMethod.requireAwardEligible(RfqMethod.COMPARE, 1, 2, "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("不少于3家有效报价");
    assertThatCode(() -> RfqMethod.requireAwardEligible(RfqMethod.AUCTION, 1, 3, "rfq-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void defaultsAndLegacyValuesMapToV1Methods() {
    assertThat(RfqMethod.orDefault(null)).isEqualTo(RfqMethod.COMPARE);
    assertThat(RfqMethod.orDefault("")).isEqualTo(RfqMethod.COMPARE);
    assertThat(RfqMethod.orDefault("询价")).isEqualTo(RfqMethod.COMPARE);
    assertThat(RfqMethod.orDefault("公开招标")).isEqualTo(RfqMethod.COMPARE);
    assertThat(RfqMethod.orDefault("邀请招标")).isEqualTo(RfqMethod.COMPARE);
    assertThat(RfqMethod.orDefault("竞争性谈判")).isEqualTo(RfqMethod.COMPARE);
    assertThat(RfqMethod.orDefault("单一来源")).isEqualTo(RfqMethod.SINGLE_SOURCE);
    assertThat(RfqMethod.isValid(RfqMethod.COMPARE)).isTrue();
    assertThat(RfqMethod.isValid(RfqMethod.SINGLE_SOURCE)).isTrue();
    assertThat(RfqMethod.isValid("拍脑袋")).isFalse();
    assertThat(RfqMethod.minSuppliers(RfqMethod.MALL)).isEqualTo(0);
    assertThat(RfqMethod.minSuppliers(RfqMethod.SINGLE_SOURCE)).isEqualTo(1);
    assertThat(RfqMethod.minSuppliers(RfqMethod.COMPARE)).isEqualTo(3);
  }
}
