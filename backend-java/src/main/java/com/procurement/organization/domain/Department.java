package com.procurement.organization.domain;

public record Department(
    String id,
    String tenantId,
    String name,
    String parentId,
    String status) {
}
