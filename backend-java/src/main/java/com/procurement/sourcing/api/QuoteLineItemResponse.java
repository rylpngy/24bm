package com.procurement.sourcing.api;

import java.math.BigDecimal;

public record QuoteLineItemResponse(
    String id,
    String description,
    String unit,
    BigDecimal quantity,
    BigDecimal unitPrice,
    BigDecimal lineAmount) {
}
