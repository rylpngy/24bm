package com.procurement.demand.domain;

import java.math.BigDecimal;

public record PurchaseDemandItem(
    String id,
    String tenantId,
    String demandId,
    String materialId,
    BigDecimal quantity) {
}
