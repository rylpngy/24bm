package com.procurement.mall.api;

import java.math.BigDecimal;
import java.util.List;

/**
 * 购物车视图(M-2):按供应商分组呈现,与结算时的拆单口径一致。
 *
 * <p>行上的单价与小计是**服务端按当前阶梯价实时算出来的**,不是加购时存下来的;
 * 供应商调价或商品下架后,购物车会如实反映,而不是停留在旧价。
 */
public record MallCartResponse(
    List<SupplierGroup> groups,
    BigDecimal total,
    int itemCount,
    /** 存在失效行(下架/超库存/不满起订量)时为 true,前端据此拦住结算按钮。 */
    boolean hasBlockedItems) {

  public record SupplierGroup(
      String supplierId,
      String supplierName,
      BigDecimal subtotal,
      List<CartLineResponse> lines) {}

  public record CartLineResponse(
      String skuId,
      String productId,
      String productName,
      String skuCode,
      String spec,
      String unit,
      BigDecimal quantity,
      /** 按当前数量落档后的单价。 */
      BigDecimal unitPrice,
      BigDecimal lineTotal,
      BigDecimal minOrderQty,
      BigDecimal stepQty,
      BigDecimal stockQty,
      int leadTimeDays,
      /** 该行为何不可结算;可结算时为空。 */
      String blockedReason) {}
}
