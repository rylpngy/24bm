package com.procurement.finance.api;

import java.math.BigDecimal;

public record InvoiceLineItemResponse(
    String id,
    String orderLineId,
    String description,
    String unit,
    BigDecimal quantity,
    BigDecimal unitPrice,
    BigDecimal lineAmount) {
}
