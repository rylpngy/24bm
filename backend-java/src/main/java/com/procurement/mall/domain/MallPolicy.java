package com.procurement.mall.domain;

import java.math.BigDecimal;

// 商城规则:上架须为正数协议价;直购须商品在架、数量为正。
public final class MallPolicy {

  private MallPolicy() {
  }

  public static void requirePublishable(BigDecimal price) {
    if (price == null || price.signum() <= 0) {
      throw new IllegalArgumentException("上架商品必须设置正数协议价");
    }
  }

  public static void requireOrderable(MallListing listing, BigDecimal quantity, String listingId) {
    if (listing == null) {
      throw new IllegalArgumentException("商城商品不存在: " + listingId);
    }
    if (!MallListingStatus.ON_SHELF.equals(listing.status())) {
      throw new IllegalStateException("商品已下架,不能下单: " + listingId);
    }
    if (quantity == null || quantity.signum() <= 0) {
      throw new IllegalArgumentException("直购数量必须为正数: " + listingId);
    }
  }
}
