package com.procurement.platform.api;

public record PlatformOverviewResponse(
    String scope,
    Integer tenantCount,
    Integer publicSupplierCount,
    Integer pendingEnterpriseReviews) {
}
