package com.procurement.platform.domain;

public final class PlatformTenantAuditAction {
  public static final String CREATED = "tenant.created";
  public static final String FEATURES_UPDATED = "tenant.features.updated";
  public static final String PLAN_UPDATED = "tenant.plan_updated";
  public static final String ENABLED = "tenant.enabled";
  public static final String DISABLED = "tenant.disabled";

  private PlatformTenantAuditAction() {}
}
