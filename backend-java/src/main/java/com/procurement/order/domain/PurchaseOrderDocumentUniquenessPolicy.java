package com.procurement.order.domain;

public final class PurchaseOrderDocumentUniquenessPolicy {
  private PurchaseOrderDocumentUniquenessPolicy() {}

  public static void requireNoDelivery(int existingDeliveryCount, String orderId) {
    if (existingDeliveryCount > 0) {
      throw new IllegalStateException("Purchase order already has a delivery: " + orderId);
    }
  }

  public static void requireNoReceipt(int existingReceiptCount, String orderId) {
    if (existingReceiptCount > 0) {
      throw new IllegalStateException("Purchase order already has a receipt: " + orderId);
    }
  }

  public static void requireNoInvoice(int existingInvoiceCount, String orderId) {
    if (existingInvoiceCount > 0) {
      throw new IllegalStateException("Purchase order already has an invoice: " + orderId);
    }
  }
}
