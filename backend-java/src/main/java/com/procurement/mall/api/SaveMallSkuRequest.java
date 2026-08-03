package com.procurement.mall.api;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

/** 建/改规格(M-1):价格与数量口径由服务端按 MallCatalogPolicy 校验。 */
public record SaveMallSkuRequest(
    String skuCode,
    /** 规格键值 JSON,如 {"颜色":"黑"};单规格商品传空或 {}。 */
    String spec,
    /** 关联物料主数据:订单与对账仍按物料口径走,建议填写。 */
    String materialId,
    String unit,
    @NotNull BigDecimal price,
    BigDecimal minOrderQty,
    BigDecimal stepQty,
    /** 空=不限量。 */
    BigDecimal stockQty,
    Integer leadTimeDays,
    List<TierPriceLine> tierPrices) {

  public record TierPriceLine(@NotNull BigDecimal minQty, @NotNull BigDecimal price) {}
}
