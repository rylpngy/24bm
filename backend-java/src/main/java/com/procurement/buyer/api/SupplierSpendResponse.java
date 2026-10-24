package com.procurement.buyer.api;

import java.math.BigDecimal;

public record SupplierSpendResponse(
    String supplierId, String supplierName, BigDecimal totalAmount,
    int orderCount, Integer sharePercent) implements com.procurement.buyer.application.ProcurementAnalyticsView.Supplier {
}
