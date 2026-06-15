package com.procurement.organization.api;

public record DepartmentResponse(
    String id,
    String tenantId,
    String name,
    String parentId,
    String status) {
}
