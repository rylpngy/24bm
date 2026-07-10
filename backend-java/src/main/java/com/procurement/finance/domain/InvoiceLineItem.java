package com.procurement.finance.domain;

import java.math.BigDecimal;

// 发票行项明细:由订单行项复制而来,行金额 = 数量 × 单价。
public record InvoiceLineItem(
    String id,
    String tenantId,
    String invoiceId,
    String orderLineId,
    String description,
    String unit,
    BigDecimal quantity,
    BigDecimal unitPrice,
    BigDecimal lineAmount,
    Integer sortNo) {
}
