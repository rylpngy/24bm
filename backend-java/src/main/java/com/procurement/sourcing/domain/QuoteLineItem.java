package com.procurement.sourcing.domain;

import java.math.BigDecimal;

// 报价行项明细:行金额 = 数量 × 单价(服务端计算并落库)。
public record QuoteLineItem(
    String id,
    String tenantId,
    String quoteId,
    String description,
    String unit,
    BigDecimal quantity,
    BigDecimal unitPrice,
    BigDecimal lineAmount,
    Integer sortNo) {
}
