package com.procurement.identity.api;

import com.procurement.identity.domain.IdentityScope;
import java.util.List;

public record LoginResponse(
    String accessToken,
    String tokenType,
    long expiresIn,
    String userId,
    String displayName,
    IdentityScope scope,
    String tenantId,
    String supplierId,
    List<String> roles) {
}
