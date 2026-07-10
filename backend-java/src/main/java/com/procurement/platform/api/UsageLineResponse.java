package com.procurement.platform.api;

import java.math.BigDecimal;

public record UsageLineResponse(
    String metric,
    String label,
    int includedQuota,
    int used,
    int overage,
    BigDecimal overageUnitPrice,
    BigDecimal overageCost) {
}
