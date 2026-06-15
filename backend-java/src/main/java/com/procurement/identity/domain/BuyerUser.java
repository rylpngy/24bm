package com.procurement.identity.domain;

public record BuyerUser(
    String id,
    String tenantId,
    String name,
    String mobile,
    String email,
    String status,
    String departmentId,
    String roleId) {
}
