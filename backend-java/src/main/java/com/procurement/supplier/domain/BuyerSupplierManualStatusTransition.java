package com.procurement.supplier.domain;

import org.springframework.stereotype.Component;

@Component
public class BuyerSupplierManualStatusTransition {

  public void requireSupportedTarget(String status) {
    if (!BuyerSupplierRelationStatus.BLACKLISTED.equals(status)
        && !BuyerSupplierRelationStatus.PENDING_ADMISSION.equals(status)) {
      throw new IllegalArgumentException("Unsupported buyer supplier relation target status: " + status);
    }
  }

  public void requireTransition(String currentStatus, String targetStatus, String relationId) {
    if (BuyerSupplierRelationStatus.IN_ADMISSION_APPROVAL.equals(currentStatus)) {
      throw new IllegalStateException(
          "Supplier relations in admission approval cannot be manually changed: " + relationId);
    }
    if (BuyerSupplierRelationStatus.PENDING_ADMISSION.equals(targetStatus)
        && !BuyerSupplierRelationStatus.BLACKLISTED.equals(currentStatus)
        && !BuyerSupplierRelationStatus.REJECTED.equals(currentStatus)) {
      throw new IllegalStateException(
          "Only blacklisted or rejected supplier relations can be restored to pending admission: " + relationId);
    }
  }
}
