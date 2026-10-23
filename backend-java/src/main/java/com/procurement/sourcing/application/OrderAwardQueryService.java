package com.procurement.sourcing.application;

import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import org.springframework.stereotype.Service;

/** Order creation reads finalized awards through the sourcing module's application boundary. */
@Service
public class OrderAwardQueryService {
  private final AwardDecisionMapper awards;
  private final RfqMapper rfqs;

  public OrderAwardQueryService(AwardDecisionMapper awards, RfqMapper rfqs) {
    this.awards = awards;
    this.rfqs = rfqs;
  }

  public AwardDecision findApproved(String tenantId, String awardId) {
    return awards.findApprovedForOrder(tenantId, awardId, ApprovalStatus.APPROVED);
  }

  public void requireFinalized(String tenantId, AwardDecision award) {
    var rfq = rfqs.findByTenantAndId(tenantId, award.rfqId());
    if (rfq == null || !ApprovalStatus.APPROVED.equals(award.approvedStatus())
        || !"已定标".equals(rfq.status()) || !award.supplierId().equals(rfq.awardedSupplierId())) {
      throw new IllegalStateException("RFQ award is not finalized for order creation: " + award.rfqId());
    }
  }
}
