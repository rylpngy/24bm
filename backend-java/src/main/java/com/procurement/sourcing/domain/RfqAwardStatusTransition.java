package com.procurement.sourcing.domain;

import org.springframework.stereotype.Component;

@Component
public class RfqAwardStatusTransition {

  public void requireAwardSubmission(String currentStatus, String rfqId) {
    if (!RfqStatus.OPENED.equals(currentStatus)) {
      throw new IllegalStateException("Only opened RFQs can be awarded: " + rfqId);
    }
  }

  public void requireAwardReview(String currentStatus, String rfqId) {
    if (!RfqStatus.AWARD_APPROVAL.equals(currentStatus)) {
      throw new IllegalStateException("Only RFQs in award approval can be reviewed: " + rfqId);
    }
  }

  // 定标审批驳回:退回「已开标」,可重新评标/改定标(无需重新开标)。
  public String reviewTargetStatus(boolean approved) {
    return approved ? RfqStatus.AWARDED : RfqStatus.OPENED;
  }
}
