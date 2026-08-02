package com.procurement.platform.domain;

import java.math.BigDecimal;

/** 供应商信用事实数据(跨租户聚合的原始计数,评分在领域策略中计算)。 */
public record SupplierCreditFacts(
    String supplierId,
    String supplierName,
    boolean verified,
    long participatedProjects,
    long awardedProjects,
    long orderCount,
    long completedOrderCount,
    long onTimeReceiptCount,
    long invoiceCount,
    long cleanReconciliationCount,
    long servedTenantCount,
    BigDecimal totalOrderAmount) {
}
