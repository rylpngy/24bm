package com.procurement.identity.domain;

import java.util.List;

public record AuthenticatedPrincipal(
    String userId,
    String displayName,
    IdentityScope scope,
    String tenantId,
    String supplierId,
    List<String> roles,
    Long sessionVersion) {
  public AuthenticatedPrincipal(String userId, String displayName, IdentityScope scope,
      String tenantId, String supplierId, List<String> roles) {
    this(userId, displayName, scope, tenantId, supplierId, roles, null);
  }
}
