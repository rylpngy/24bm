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
    Integer sortNo,
    // 对应的采购清单行(需求物资明细 ID);历史自由报价行为空。
    String demandItemId) {
}
