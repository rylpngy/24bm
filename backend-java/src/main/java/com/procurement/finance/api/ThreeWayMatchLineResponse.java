package com.procurement.finance.api;

import java.math.BigDecimal;

// 行级三单匹配结论:订单↔收货↔发票按行对照,amountVariance/lineMatchStatus 标注差异。
public record ThreeWayMatchLineResponse(
    String orderLineId,
    String description,
    String unit,
    BigDecimal orderedQuantity,
    BigDecimal orderUnitPrice,
    BigDecimal orderLineAmount,
    BigDecimal receivedQuantity,
    BigDecimal qualifiedQuantity,
    BigDecimal invoicedQuantity,
    BigDecimal invoiceUnitPrice,
    BigDecimal invoiceLineAmount,
    BigDecimal amountVariance,
    String lineMatchStatus) {
}
