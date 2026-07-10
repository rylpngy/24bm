package com.procurement.identity.api;

import java.util.List;

public record BuyerRoleResponse(
    String id,
    String tenantId,
    String name,
    List<String> permissions,
    String dataScope) {
}
