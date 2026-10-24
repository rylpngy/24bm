package com.procurement.demand.domain;

import org.springframework.stereotype.Component;

@Component
public class PurchaseDemandApprovalStatusTransition {

  public void requireSubmission(String currentStatus, String demandId) {
    if (!PurchaseDemandStatus.DRAFT.equals(currentStatus) && !PurchaseDemandStatus.REJECTED.equals(currentStatus)) {
      throw new IllegalStateException("Only draft purchase demands can be submitted: " + demandId);
    }
  }

  public void requireReview(String currentStatus, String demandId) {
    if (!PurchaseDemandStatus.IN_APPROVAL.equals(currentStatus)) {
      throw new IllegalStateException("Only in-approval purchase demands can be reviewed: " + demandId);
    }
  }

  public String reviewTargetStatus(boolean approved) {
    return approved ? PurchaseDemandStatus.APPROVED : PurchaseDemandStatus.REJECTED;
  }
}
