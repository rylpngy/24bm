package com.procurement.identity.api;

public record BuyerUserResponse(
    String id,
    String tenantId,
    String name,
    String mobile,
    String email,
    String status,
    String departmentId) {
}
