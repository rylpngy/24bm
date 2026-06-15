package com.procurement.platform.api;

import java.util.List;

public record PlatformWorkspaceResponse(
    PlatformOverviewResponse overview,
    PlatformOperationSummaryResponse operationSummary,
    List<TenantResponse> tenants,
    List<EnterpriseReviewResponse> enterpriseReviews) {
}
