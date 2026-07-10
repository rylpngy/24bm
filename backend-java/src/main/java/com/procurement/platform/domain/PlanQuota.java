package com.procurement.platform.domain;

import java.math.BigDecimal;

public record PlanQuota(
    String planCode,
    String metric,
    Integer includedQuota,
    BigDecimal overageUnitPrice) {
}
