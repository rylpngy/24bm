package com.procurement.supplier.domain;

/** 可见收货单的表头整数数量聚合，不混入行项的小数单位。 */
public record SupplierPeriodMetrics(
    int receiptCount,
    int onTimeCount,
    long totalReceived,
    long totalQualified,
    int scheduledReceiptCount,
    Integer onTimeRate,
    Integer qualifiedRate) {
}
