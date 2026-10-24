package com.procurement.order.domain;

public final class PurchaseOrderDocumentUniquenessPolicy {
  private PurchaseOrderDocumentUniquenessPolicy() {}

  public static void requireNoInvoice(int existingInvoiceCount, String orderId) {
    if (existingInvoiceCount > 0) {
      throw new IllegalStateException("Purchase order already has an invoice: " + orderId);
    }
  }
}
