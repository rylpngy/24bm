package com.procurement.supplier.api;

import java.time.LocalDate;

// 按上海时区收货登记时间统计，日期区间左闭右开；未传周期时为数据范围内累计。
// 准时率只包含有预计日期的已登记收货样本，不含未收货订单；数量使用收货单表头。
public record SupplierFulfillmentMetricsResponse(
    String supplierId,
    int receiptCount,
    int onTimeCount,
    Integer onTimeRate,
    long totalReceived,
    long totalQualified,
    Integer qualifiedRate,
    Integer derivedQualityScore,
    Integer derivedDeliveryScore,
    String period,
    LocalDate startDate,
    LocalDate endDateExclusive,
    int scheduledReceiptCount) {
}
