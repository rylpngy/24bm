package com.procurement.identity.api;

import java.util.List;

public record BuyerRoleResponse(
    String id,
    String tenantId,
    String name,
    List<String> permissions,
    String dataScope,
    boolean builtIn,
    boolean protectedRole) {

  public BuyerRoleResponse(String id, String tenantId, String name, List<String> permissions,
      String dataScope, boolean builtIn) {
    this(id, tenantId, name, permissions, dataScope, builtIn, false);
  }

  public BuyerRoleResponse(
      String id,
      String tenantId,
      String name,
      List<String> permissions,
      String dataScope) {
    this(id, tenantId, name, permissions, dataScope, false);
  }
}
