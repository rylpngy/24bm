package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.sourcing.domain.RfqMethod;
import org.junit.jupiter.api.Test;

// 1.0 采购方式:询比、竞价、商城、单一来源;旧招标类方式仅做兼容映射。
class RfqMethodTests {

  @Test
  void compareAndAuctionSupplierFloorIsAdvisoryNotBlocking() {
    // 家数门槛放宽:低于 3 家不阻断(民企/非依法必招项目),仅返回提醒文案供留痕。
    assertThatCode(() -> RfqMethod.requireSupplierCount(RfqMethod.COMPARE, 2))
        .doesNotThrowAnyException();
    assertThat(RfqMethod.supplierCountAdvisory(RfqMethod.COMPARE, 2)).contains("参考邀请家数").contains("留痕");
    assertThat(RfqMethod.supplierCountAdvisory(RfqMethod.COMPARE, 3)).isNull();
    assertThat(RfqMethod.supplierCountAdvisory(RfqMethod.AUCTION, 0)).isNull();
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
        .hasMessageContaining("至少 1 家有效报价");
  }

  @Test
  void awardQuorumIsAdvisoryNotBlocking() {
    // 定标家数放宽:2 家可定标但产生提醒;无报价仍硬阻断(结构性)。
    assertThatCode(() -> RfqMethod.requireAwardEligible(RfqMethod.COMPARE, 1, 2, "rfq-1"))
        .doesNotThrowAnyException();
    assertThat(RfqMethod.awardQuorumAdvisory(RfqMethod.COMPARE, 2)).contains("参考定标家数").contains("留痕");
    assertThat(RfqMethod.awardQuorumAdvisory(RfqMethod.AUCTION, 3)).isNull();
    assertThatThrownBy(() -> RfqMethod.requireAwardEligible(RfqMethod.COMPARE, 1, 0, "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("至少 1 家有效报价");
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

  @Test
  void singleSourceRequiresJustificationAndOthersRejectIt() {
    assertThatThrownBy(() -> RfqMethod.requireSourceJustification(RfqMethod.SINGLE_SOURCE, null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("来源说明");
    assertThatThrownBy(() -> RfqMethod.requireSourceJustification(RfqMethod.SINGLE_SOURCE, "  "))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatCode(() -> RfqMethod.requireSourceJustification(RfqMethod.SINGLE_SOURCE, "原厂唯一授权服务商"))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> RfqMethod.requireSourceJustification(RfqMethod.COMPARE, "不该有"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("仅单一来源");
    assertThatCode(() -> RfqMethod.requireSourceJustification(RfqMethod.COMPARE, null))
        .doesNotThrowAnyException();
  }
}
