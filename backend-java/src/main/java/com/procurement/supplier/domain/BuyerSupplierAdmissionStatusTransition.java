package com.procurement.supplier.domain;

import org.springframework.stereotype.Component;

@Component
public class BuyerSupplierAdmissionStatusTransition {

  public void requireAdmissionSubmission(String currentStatus, String relationId) {
    if (!BuyerSupplierRelationStatus.PENDING_ADMISSION.equals(currentStatus)
        && !BuyerSupplierRelationStatus.REJECTED.equals(currentStatus)) {
      throw new IllegalStateException(
          "Only pending supplier relations can be submitted for admission: " + relationId);
    }
  }

  public void requireAdmissionReview(String currentStatus, String relationId) {
    if (!BuyerSupplierRelationStatus.IN_ADMISSION_APPROVAL.equals(currentStatus)) {
      throw new IllegalStateException(
          "Only supplier relations in admission approval can be reviewed: " + relationId);
    }
  }

  public String reviewTargetStatus(boolean approved) {
    return approved ? BuyerSupplierRelationStatus.ADMITTED : BuyerSupplierRelationStatus.REJECTED;
  }
}
