package com.procurement.common.tenant;

public final class TenantAccessGuard {

  private TenantAccessGuard() {
  }

  public static String requireTenantId(String apiName) {
    return require(TenantContext.tenantId(), "Tenant context is required for " + apiName + ".");
  }

  public static String requireSupplierId(String apiName) {
    return require(TenantContext.supplierId(), "Supplier context is required for " + apiName + ".");
  }

  public static String requireUserId(String apiName) {
    return require(TenantContext.userId(), "User context is required for " + apiName + ".");
  }

  public static String requirePlatformUserId(String apiName) {
    String userId = requireUserId(apiName);
    if (TenantContext.tenantId() != null || TenantContext.supplierId() != null) {
      throw new PermissionDeniedException("Platform context is required for " + apiName + ".");
    }
    return userId;
  }

  private static String require(String value, String message) {
    if (value == null || value.isBlank()) {
      throw new IllegalStateException(message);
    }
    return value;
  }
}
