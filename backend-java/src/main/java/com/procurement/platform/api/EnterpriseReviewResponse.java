package com.procurement.platform.api;

public record EnterpriseReviewResponse(
    String id,
    String name,
    String type,
    Boolean verified,
    String reviewStatus,
    String reviewComment,
    Boolean profileConfirmed,
    Boolean riskConfirmed) {
}
