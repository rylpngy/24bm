package com.procurement.order.api;

import java.math.BigDecimal;

public record OrderLineItemResponse(
    String id,
    String description,
    String unit,
    BigDecimal quantity,
    BigDecimal unitPrice,
    BigDecimal lineAmount) {
}
