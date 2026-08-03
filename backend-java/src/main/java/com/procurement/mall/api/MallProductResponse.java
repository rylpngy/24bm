package com.procurement.mall.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * 商城商品(M-1):列表与详情共用。
 *
 * <p>skus 在列表场景可为空数组(只给起价与规格数),详情场景给全量规格与阶梯价。
 */
public record MallProductResponse(
    String id,
    /** tenant=私域协议价商品;public=公开专区标准品。 */
    String scope,
    String supplierId,
    String supplierName,
    String categoryId,
    String categoryName,
    String name,
    String brand,
    String descriptionHtml,
    String mainImageKey,
    String status,
    /** 最低可售单价(取各在架规格基础价的最小值);无在架规格时为空。 */
    BigDecimal fromPrice,
    int skuCount,
    List<MallSkuResponse> skus,
    List<String> mediaKeys,
    OffsetDateTime updatedAt) {

  public record MallSkuResponse(
      String id,
      String skuCode,
      /** 规格键值 JSON 原文,前端按键值渲染规格选择器。 */
      String spec,
      String materialId,
      String unit,
      BigDecimal price,
      BigDecimal minOrderQty,
      BigDecimal stepQty,
      /** 空=不限量。 */
      BigDecimal stockQty,
      int leadTimeDays,
      String status,
      List<TierPriceResponse> tierPrices) {}

  public record TierPriceResponse(BigDecimal minQty, BigDecimal price) {}
}
