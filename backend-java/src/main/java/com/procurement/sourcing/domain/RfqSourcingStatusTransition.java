package com.procurement.sourcing.domain;

import com.procurement.demand.domain.PurchaseDemandStatus;
import java.time.OffsetDateTime;
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

  public void requireFutureDeadline(OffsetDateTime deadlineAt, String rfqId) {
    if (deadlineAt == null || !deadlineAt.isAfter(OffsetDateTime.now())) {
      throw new IllegalArgumentException("RFQ deadline must be in the future: " + rfqId);
    }
  }

  public void requireOpenQuoteDeadline(OffsetDateTime deadlineAt, String rfqId) {
    if (deadlineAt == null || !deadlineAt.isAfter(OffsetDateTime.now())) {
      throw new IllegalStateException("RFQ quote deadline has passed: " + rfqId);
    }
  }
}
