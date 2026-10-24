package com.procurement.buyer.api;

import java.math.BigDecimal;

public record MonthlySpendResponse(String period, BigDecimal totalAmount, int orderCount)
    implements com.procurement.buyer.application.ProcurementAnalyticsView.Monthly {
}
