package com.procurement.sourcing.api;

import java.math.BigDecimal;

public record QuoteLineItemResponse(
    String id,
    String description,
    String unit,
    BigDecimal quantity,
    BigDecimal unitPrice,
    BigDecimal lineAmount,
    // 对应的采购清单行:采购方按此逐行横向比价。
    String demandItemId) {
}
