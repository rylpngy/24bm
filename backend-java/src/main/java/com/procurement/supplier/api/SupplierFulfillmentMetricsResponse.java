package com.procurement.supplier.api;

// 供应商实测绩效:由真实收货验收数据导出的质量分(合格率)与交付分(准时率)+ 统计明细。
public record SupplierFulfillmentMetricsResponse(
    String supplierId,
    int receiptCount,
    int onTimeCount,
    Integer onTimeRate,
    long totalReceived,
    long totalQualified,
    Integer qualifiedRate,
    Integer derivedQualityScore,
    Integer derivedDeliveryScore) {
}
