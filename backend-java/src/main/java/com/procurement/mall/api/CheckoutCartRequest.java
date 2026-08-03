package com.procurement.mall.api;

import java.time.LocalDate;

/**
 * 服务端购物车结算(M-2)。
 *
 * <p>不带商品明细——以服务端购物车为准,避免前端提交与购物车不一致的清单。
 * addressId 缺省时用默认地址;expectedReceiptDate 缺省时按各 SKU 承诺交期推算。
 */
public record CheckoutCartRequest(
    String addressId,
    LocalDate expectedReceiptDate,
    String remark) {
}
