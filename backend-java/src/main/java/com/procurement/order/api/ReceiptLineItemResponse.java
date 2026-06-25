package com.procurement.order.api;

import java.math.BigDecimal;

public record ReceiptLineItemResponse(
    String id,
    String orderLineId,
    String description,
    String unit,
    BigDecimal orderedQuantity,
    BigDecimal receivedQuantity,
    BigDecimal qualifiedQuantity) {
}
