package com.procurement.mall.domain;

import java.math.BigDecimal;

/**
 * 购物车行(M-2):只存 SKU 与数量,**不存价格**。
 *
 * <p>成交价一律在结算时按当时的阶梯价重算——加购时的价格不作数,
 * 否则供应商调价后购物车会按旧价成交。
 */
public record MallCartItem(
    String id,
    String cartId,
    String skuId,
    BigDecimal quantity) {
}
