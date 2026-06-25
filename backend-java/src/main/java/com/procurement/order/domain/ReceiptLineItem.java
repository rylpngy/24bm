package com.procurement.order.domain;

import java.math.BigDecimal;

// 收货验收行项:逐行登记收货/合格数量,关联订单行项。
public record ReceiptLineItem(
    String id,
    String tenantId,
    String receiptId,
    String orderLineId,
    String description,
    String unit,
    BigDecimal orderedQuantity,
    BigDecimal receivedQuantity,
    BigDecimal qualifiedQuantity,
    Integer sortNo) {
}
