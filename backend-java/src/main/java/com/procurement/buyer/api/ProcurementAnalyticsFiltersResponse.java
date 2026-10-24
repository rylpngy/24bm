package com.procurement.buyer.api;

import java.time.LocalDate;

public record ProcurementAnalyticsFiltersResponse(
    LocalDate fromDate, LocalDate toDate, String supplierId, String status)
    implements com.procurement.buyer.application.ProcurementAnalyticsView.Filters {}
