package com.procurement.supplier.domain;

// 供应商实测履约聚合:由真实收货验收数据统计(验收单数 / 准时数 / 收货合计 / 合格合计)。
public record SupplierFulfillmentMetrics(
    int receiptCount,
    int onTimeCount,
    long totalReceived,
    long totalQualified) {
}
