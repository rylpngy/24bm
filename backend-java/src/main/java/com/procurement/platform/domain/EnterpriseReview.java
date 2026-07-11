package com.procurement.platform.domain;

public record EnterpriseReview(
    String id,
    String name,
    String type,
    Boolean verified,
    String reviewStatus,
    String reviewComment,
    Boolean profileConfirmed,
    Boolean riskConfirmed,
    String industry,
    String creditCode,
    String legalPerson,
    String contactName,
    String contactPhone,
    String contactEmail) {
}
