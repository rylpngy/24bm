package com.procurement.sourcing.domain;

import com.procurement.demand.domain.PurchaseDemandStatus;
import org.springframework.stereotype.Component;

@Component
public class RfqSourcingStatusTransition {

  public void requireApprovedDemandForRfq(String demandStatus, String demandId) {
    if (!PurchaseDemandStatus.APPROVED.equals(demandStatus)) {
      throw new IllegalStateException("RFQ can only use approved purchase demands: " + demandId);
    }
  }

  public void requireQuotingForQuoteSubmission(String rfqStatus, String rfqId) {
    if (!RfqStatus.QUOTING.equals(rfqStatus)) {
      throw new IllegalStateException("RFQ is not open for quotes: " + rfqId);
    }
  }
}
