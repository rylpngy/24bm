package com.procurement.platform.api;

import java.util.List;

public record PlatformWorkspaceResponse(
    PlatformOverviewResponse overview,
    List<TenantResponse> tenants,
    List<EnterpriseReviewResponse> enterpriseReviews) {
}
