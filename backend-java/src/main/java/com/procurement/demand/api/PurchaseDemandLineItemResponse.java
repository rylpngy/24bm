package com.procurement.demand.api;

import java.math.BigDecimal;

public record PurchaseDemandLineItemResponse(
    String id,
    String materialId,
    BigDecimal quantity) {
}
