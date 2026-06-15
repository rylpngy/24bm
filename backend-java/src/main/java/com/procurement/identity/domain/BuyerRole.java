package com.procurement.identity.domain;

import java.util.List;

public record BuyerRole(
    String id,
    String tenantId,
    String name,
    List<String> permissions) {
}
