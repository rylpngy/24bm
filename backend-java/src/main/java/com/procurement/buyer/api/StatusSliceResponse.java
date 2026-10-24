package com.procurement.buyer.api;

import java.math.BigDecimal;

public record StatusSliceResponse(String status, int orderCount, BigDecimal totalAmount)
    implements com.procurement.buyer.application.ProcurementAnalyticsView.Status {
}
