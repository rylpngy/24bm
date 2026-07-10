package com.procurement.sourcing.domain;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class RfqSupplierInvitationPolicy {
  private RfqSupplierInvitationPolicy() {}

  public static void requireValidInviteList(List<String> supplierIds) {
    if (supplierIds == null || supplierIds.isEmpty()) {
      return;
    }
    Set<String> seenSupplierIds = new HashSet<>();
    for (String supplierId : supplierIds) {
      if (!seenSupplierIds.add(supplierId)) {
        throw new IllegalArgumentException("RFQ cannot invite the same supplier more than once: " + supplierId);
      }
    }
  }

  public static void requireAdmittedSupplier(int admittedRelationCount, String supplierId) {
    if (admittedRelationCount == 0) {
      throw new IllegalStateException("Supplier is not approved for tenant RFQ: " + supplierId);
    }
  }

  public static void requireActiveQualification(int activeQualificationCount, String supplierId) {
    if (activeQualificationCount == 0) {
      throw new IllegalStateException("Supplier lacks active qualification for tenant RFQ: " + supplierId);
    }
  }
}
