package com.procurement.common.tenant;

public final class TenantContext {
  private static final ThreadLocal<String> TENANT_ID = new ThreadLocal<>();
  private static final ThreadLocal<String> SUPPLIER_ID = new ThreadLocal<>();
  private static final ThreadLocal<String> USER_ID = new ThreadLocal<>();

  private TenantContext() {
  }

  public static void set(String tenantId, String supplierId, String userId) {
    TENANT_ID.set(tenantId);
    SUPPLIER_ID.set(supplierId);
    USER_ID.set(userId);
  }

  public static String tenantId() {
    return TENANT_ID.get();
  }

  public static String supplierId() {
    return SUPPLIER_ID.get();
  }

  public static String userId() {
    return USER_ID.get();
  }

  public static void clear() {
    TENANT_ID.remove();
    SUPPLIER_ID.remove();
    USER_ID.remove();
  }
}
