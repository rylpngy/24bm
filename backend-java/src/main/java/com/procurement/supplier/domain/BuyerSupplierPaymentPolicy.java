package com.procurement.supplier.domain;

public final class BuyerSupplierPaymentPolicy {
  private BuyerSupplierPaymentPolicy() {}

  public static void requirePayable(int blacklistedRelationCount, String supplierId) {
    if (blacklistedRelationCount > 0) {
      throw new IllegalStateException("Blacklisted supplier cannot be paid: " + supplierId);
    }
  }
}
