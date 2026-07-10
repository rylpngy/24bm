package com.procurement.mall.api;

import java.math.BigDecimal;
import java.util.List;

public record MallAnalyticsResponse(
    int totalOrders,
    BigDecimal totalAmount,
    int onShelfListings,
    List<MallSupplierSpendResponse> supplierSpend) {
}
