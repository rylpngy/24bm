package com.procurement.buyer.api;

import java.math.BigDecimal;
import java.util.List;

// 旧字段名保留兼容；totalSpend是订单金额，biddingSavings是可比报价差额，口径以metadata为准。
public record ProcurementAnalyticsResponse(
    BigDecimal totalSpend,
    int orderCount,
    int supplierCount,
    BigDecimal biddingSavings,
    Integer topSupplierSharePercent,
    List<MonthlySpendResponse> monthlySpend,
    List<SupplierSpendResponse> supplierSpend,
    List<StatusSliceResponse> statusDistribution,
    List<CategorySpendResponse> categorySpend,
    List<CategorySpendResponse> categoryDemandEstimate,
    ProcurementAnalyticsMetadataResponse metadata) implements com.procurement.buyer.application.ProcurementAnalyticsView {
}
