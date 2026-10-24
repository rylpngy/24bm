package com.procurement.buyer.api;

import java.time.Instant;

public record ProcurementAnalyticsMetadataResponse(
    ProcurementAnalyticsFiltersResponse appliedFilters,
    String definitionVersion,
    Instant createdAt,
    String timezone,
    String scopeDescription,
    String orderAmountBasis,
    String quoteDifferenceBasis,
    String estimateBoundary) implements com.procurement.buyer.application.ProcurementAnalyticsView.Metadata {}
