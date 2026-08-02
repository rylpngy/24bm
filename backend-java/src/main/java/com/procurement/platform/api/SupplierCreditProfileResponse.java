package com.procurement.platform.api;

import java.math.BigDecimal;

/**
 * 供应商信用画像(D-3):跨租户真实履约数据聚合,平台级视角。
 * 信用分由四项行为指标加权(中标率 20% + 订单完成率 35% + 准时交付率 30% + 对账通过率 15%),
 * 无履约样本时不评分(scoreable=false),避免"零数据满分"误导。
 */
public record SupplierCreditProfileResponse(
    String supplierId,
    String supplierName,
    boolean verified,
    // 参与与中标
    long participatedProjects,
    long awardedProjects,
    BigDecimal winRate,
    // 履约
    long orderCount,
    long completedOrderCount,
    BigDecimal completionRate,
    long onTimeReceiptCount,
    BigDecimal onTimeRate,
    // 结算
    long invoiceCount,
    long cleanReconciliationCount,
    BigDecimal reconciliationPassRate,
    // 合作广度与成交额
    long servedTenantCount,
    BigDecimal totalOrderAmount,
    // 综合
    boolean scoreable,
    BigDecimal creditScore,
    String creditLevel) {
}
