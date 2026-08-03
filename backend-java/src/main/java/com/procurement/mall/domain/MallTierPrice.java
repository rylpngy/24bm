package com.procurement.mall.domain;

import java.math.BigDecimal;

/** 阶梯价档位:结算数量达到 minQty 即适用 price。 */
public record MallTierPrice(String skuId, BigDecimal minQty, BigDecimal price) {
}
