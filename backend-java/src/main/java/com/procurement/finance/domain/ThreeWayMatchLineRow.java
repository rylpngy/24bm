package com.procurement.finance.domain;

import java.math.BigDecimal;

// 行级三单匹配的连接行:以订单行项为脊柱,左连收货行项与发票行项(按 order_line_id)。
// 收货/发票字段可空(尚未收货或开票)。
public record ThreeWayMatchLineRow(
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
    BigDecimal invoiceLineAmount) {
}
