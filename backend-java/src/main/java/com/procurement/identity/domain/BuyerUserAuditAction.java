package com.procurement.identity.domain;

public final class BuyerUserAuditAction {
  public static final String CREATED = "buyer_user.created";
  public static final String ROLE_CHANGED = "buyer_user.role_changed";
  public static final String STATUS_CHANGED = "buyer_user.status_changed";
  public static final String PASSWORD_RESET = "buyer_user.password_reset";

  private BuyerUserAuditAction() {}
}
