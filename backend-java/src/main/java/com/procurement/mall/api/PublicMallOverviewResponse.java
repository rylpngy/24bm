package com.procurement.mall.api;

import java.util.List;

// 公开商城概览:在架商品的品类分布与精选商品(仅名称/品类/单位,协议价登录后可见)。
public record PublicMallOverviewResponse(
    List<CategoryCount> categories,
    List<FeaturedItem> featured) {

  public record CategoryCount(String category, Integer listingCount) {}

  public record FeaturedItem(String name, String category, String unit) {}
}
