package com.procurement.order.domain;

public final class PurchaseOrderAuditAction {
  public static final String CREATED = "purchase_order.created";
  public static final String CONFIRMED = "purchase_order.confirmed";
  public static final String SHIPPED = "purchase_order.shipped";
  public static final String RECEIVED = "purchase_order.received";

  private PurchaseOrderAuditAction() {}
}
