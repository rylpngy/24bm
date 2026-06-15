package com.procurement.platform.domain;

public record EnterpriseReview(
    String id,
    String name,
    String type,
    Boolean verified,
    String reviewStatus) {
}
