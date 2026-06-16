package com.procurement.order.domain;

import org.springframework.stereotype.Component;

@Component
public class PurchaseOrderStatusTransition {

  public void requireSupplierConfirmation(String currentStatus, String orderId) {
    if (!PurchaseOrderStatus.PENDING_SUPPLIER_CONFIRMATION.equals(currentStatus)) {
      throw new IllegalStateException("Only pending supplier confirmation orders can be confirmed: " + orderId);
    }
  }

  public void requireShipment(String currentStatus, String orderId) {
    if (!PurchaseOrderStatus.PENDING_SHIPMENT.equals(currentStatus)) {
      throw new IllegalStateException("Only ready-to-ship orders can be shipped: " + orderId);
    }
  }

  public void requireReceipt(String currentStatus, String orderId) {
    if (!PurchaseOrderStatus.SHIPPED.equals(currentStatus)) {
      throw new IllegalStateException("Only shipped purchase orders can be received: " + orderId);
    }
  }
}
