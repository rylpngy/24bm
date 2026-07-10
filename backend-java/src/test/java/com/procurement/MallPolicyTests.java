package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.mall.domain.MallListing;
import com.procurement.mall.domain.MallListingStatus;
import com.procurement.mall.domain.MallPolicy;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

// 商城规则:上架须正数协议价;直购须在架商品且数量为正。
class MallPolicyTests {

  private MallListing listing(String status) {
    return new MallListing(
        "mall-1", "tenant-1", "supplier-1", "旭日办公", "mat-1", "A4 复印纸",
        "MAT-001", "办公用品", "箱", new BigDecimal("120"), status, null, null);
  }

  @Test
  void publishRequiresPositivePrice() {
    assertThatThrownBy(() -> MallPolicy.requirePublishable(null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("协议价");
    assertThatThrownBy(() -> MallPolicy.requirePublishable(BigDecimal.ZERO))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatCode(() -> MallPolicy.requirePublishable(new BigDecimal("99.5")))
        .doesNotThrowAnyException();
  }

  @Test
  void orderRequiresOnShelfListingAndPositiveQuantity() {
    assertThatThrownBy(() -> MallPolicy.requireOrderable(null, BigDecimal.ONE, "mall-x"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("不存在");
    assertThatThrownBy(() -> MallPolicy.requireOrderable(
        listing(MallListingStatus.OFF_SHELF), BigDecimal.ONE, "mall-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("下架");
    assertThatThrownBy(() -> MallPolicy.requireOrderable(
        listing(MallListingStatus.ON_SHELF), BigDecimal.ZERO, "mall-1"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("数量");
    assertThatCode(() -> MallPolicy.requireOrderable(
        listing(MallListingStatus.ON_SHELF), new BigDecimal("3"), "mall-1"))
        .doesNotThrowAnyException();
  }
}
