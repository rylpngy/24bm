package com.procurement.identity.domain;

public record BuyerRole(
    String id,
    String tenantId,
    String name,
    String permissionsJson,
    String dataScope) {
}
