package com.procurement.sourcing.domain;

import org.springframework.stereotype.Component;

@Component
public class RfqAwardStatusTransition {

  public void requireAwardSubmission(String currentStatus, String rfqId) {
    if (!RfqStatus.QUOTING.equals(currentStatus)) {
      throw new IllegalStateException("Only quoting RFQs can be awarded: " + rfqId);
    }
  }

  public void requireAwardReview(String currentStatus, String rfqId) {
    if (!RfqStatus.AWARD_APPROVAL.equals(currentStatus)) {
      throw new IllegalStateException("Only RFQs in award approval can be reviewed: " + rfqId);
    }
  }

  public String reviewTargetStatus(boolean approved) {
    return approved ? RfqStatus.AWARDED : RfqStatus.QUOTING;
  }
}
