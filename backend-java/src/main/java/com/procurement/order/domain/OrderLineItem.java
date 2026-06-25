package com.procurement.order.domain;

import java.math.BigDecimal;

// 订单行项明细:由中标报价行项复制而来,行金额 = 数量 × 单价。
public record OrderLineItem(
    String id,
    String tenantId,
    String orderId,
    String description,
    String unit,
    BigDecimal quantity,
    BigDecimal unitPrice,
    BigDecimal lineAmount,
    Integer sortNo) {
}
