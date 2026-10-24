package com.procurement.identity.domain;

public final class BuyerRolePolicy {
  private BuyerRolePolicy() {}

  public static boolean isProtectedOwner(String id, String tenantId) {
    return "role-buyer-owner".equals(id)
        || (tenantId != null && ("role-" + tenantId + "-buyer-owner").equals(id));
  }

  public static boolean isBuiltIn(String id, String tenantId) {
    return isProtectedOwner(id, tenantId) || (id != null && id.startsWith("role-buyer-"));
  }
}
