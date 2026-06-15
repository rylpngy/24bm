package com.procurement.platform.api;

public record PlatformOperationSummaryResponse(
    Integer tenantCount,
    long activeTenantCount,
    Integer publicSupplierCount,
    Integer pendingEnterpriseReviewCount) {
}
