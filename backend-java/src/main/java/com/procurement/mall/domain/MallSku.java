package com.procurement.mall.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** 规格单品:商品下的可售单元;stockQty 为空表示不限量(服务类商品)。 */
public record MallSku(
    String id,
    String productId,
    String skuCode,
    String spec,
    String materialId,
    String unit,
    BigDecimal price,
    BigDecimal minOrderQty,
    BigDecimal stepQty,
    BigDecimal stockQty,
    int leadTimeDays,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
