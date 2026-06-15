package com.procurement.identity.domain;

import java.util.List;

public record AuthenticatedPrincipal(
    String userId,
    String displayName,
    IdentityScope scope,
    String tenantId,
    String supplierId,
    List<String> roles) {
}
