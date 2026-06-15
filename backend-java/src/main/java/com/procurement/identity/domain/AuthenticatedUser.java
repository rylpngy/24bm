package com.procurement.identity.domain;

public record AuthenticatedUser(
    String userId,
    String tenantId,
    String supplierId,
    String displayName) {
}
