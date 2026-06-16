package com.procurement.finance.domain;

import com.procurement.order.domain.PurchaseOrderStatus;

public final class InvoiceCreationStatusPolicy {
  private InvoiceCreationStatusPolicy() {}

  public static void requireReceivedOrder(String orderStatus, String orderId) {
    if (!PurchaseOrderStatus.RECEIVED.equals(orderStatus)) {
      throw new IllegalStateException("Only received purchase orders can be invoiced: " + orderId);
    }
  }
}
