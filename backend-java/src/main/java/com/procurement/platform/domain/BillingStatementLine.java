package com.procurement.platform.domain;

import java.math.BigDecimal;

public record BillingStatementLine(
    String id,
    String statementId,
    String metric,
    String label,
    int includedQuota,
    int used,
    int overage,
    BigDecimal overageUnitPrice,
    BigDecimal overageCost,
    int sortNo) {
}
