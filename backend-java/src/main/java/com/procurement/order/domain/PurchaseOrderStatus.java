package com.procurement.order.domain;

public final class PurchaseOrderStatus {
  public static final String PENDING_SUPPLIER_CONFIRMATION = "待供应商确认";
  public static final String PENDING_SHIPMENT = "待发货";
  public static final String SHIPPED = "已发货";

  private PurchaseOrderStatus() {
  }
}
