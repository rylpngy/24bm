package com.procurement.buyer.api;

import java.math.BigDecimal;
import java.util.List;

// 采购洞察:总支出/订单数/供应商数/比价节支/头部供应商集中度 + 月度趋势/供应商支出/状态分布。
public record ProcurementAnalyticsResponse(
    BigDecimal totalSpend,
    int orderCount,
    int supplierCount,
    BigDecimal biddingSavings,
    Integer topSupplierSharePercent,
    List<MonthlySpendResponse> monthlySpend,
    List<SupplierSpendResponse> supplierSpend,
    List<StatusSliceResponse> statusDistribution) {
}
