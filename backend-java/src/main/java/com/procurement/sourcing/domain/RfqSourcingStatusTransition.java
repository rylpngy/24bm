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

  // 开标:仅「报价中(封存)」可开标。
  public void requireQuotingForOpen(String rfqStatus, String rfqId) {
    if (!RfqStatus.QUOTING.equals(rfqStatus)) {
      throw new IllegalStateException("Only sealed (quoting) RFQs can be opened: " + rfqId);
    }
  }

  // 未到截止时间需显式强制开标,否则按正常到点开标。
  public void requireDeadlinePassedOrForce(OffsetDateTime deadlineAt, boolean force, String rfqId) {
    if (!force && deadlineAt != null && deadlineAt.isAfter(OffsetDateTime.now())) {
      throw new IllegalStateException("RFQ deadline has not passed; force open required: " + rfqId);
    }
  }

  // 评标/查看报价明细需已开标(报价中=封存,禁止)。
  public void requireOpenedForEvaluation(String rfqStatus, String rfqId) {
    if (RfqStatus.QUOTING.equals(rfqStatus)) {
      throw new IllegalStateException("RFQ quotes are sealed until bids are opened: " + rfqId);
    }
  }
}
