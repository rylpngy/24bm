package com.procurement.identity.domain;

public record AuthenticatedUser(
    String userId,
    String tenantId,
    String supplierId,
    String displayName,
    String passwordHash,
    long sessionVersion) {
  public AuthenticatedUser(String userId, String tenantId, String supplierId,
      String displayName, String passwordHash) {
    this(userId, tenantId, supplierId, displayName, passwordHash, 0);
  }
}
