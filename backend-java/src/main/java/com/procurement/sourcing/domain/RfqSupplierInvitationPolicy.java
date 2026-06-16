package com.procurement.sourcing.domain;

public final class RfqSupplierInvitationPolicy {
  private RfqSupplierInvitationPolicy() {}

  public static void requireAdmittedSupplier(int admittedRelationCount, String supplierId) {
    if (admittedRelationCount == 0) {
      throw new IllegalStateException("Supplier is not approved for tenant RFQ: " + supplierId);
    }
  }
}
