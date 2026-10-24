package com.procurement.buyer.api;

import java.math.BigDecimal;

public record CategorySpendResponse(String category, BigDecimal totalAmount)
    implements com.procurement.buyer.application.ProcurementAnalyticsView.Category {
}
