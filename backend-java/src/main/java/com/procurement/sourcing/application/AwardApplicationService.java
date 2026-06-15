package com.procurement.sourcing.application;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.sourcing.api.AwardDecisionResponse;
import com.procurement.sourcing.api.AwardRfqRequest;
import com.procurement.sourcing.api.ReviewAwardApprovalRequest;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AwardApplicationService {
  private static final String QUOTING_RFQ_STATUS = "报价中";
  private static final String AWARD_APPROVAL_RFQ_STATUS = "定标审批中";
  private static final String SUBMITTED_QUOTE_STATUS = "已提交";
  private static final String AWARDED_RFQ_STATUS = "已定标";
  private static final String PENDING_APPROVAL_STATUS = "待审批";
  private static final String APPROVED_STATUS = "已通过";
  private static final String REJECTED_STATUS = "已驳回";
  private static final String RFQ_AWARD_BIZ_TYPE = "rfq_award";
  private static final String RFQ_AWARD_SUBMITTED_ACTION = "rfq_award.submitted";
  private static final String RFQ_AWARD_APPROVED_ACTION = "rfq_award.approved";
  private static final String RFQ_AWARD_REJECTED_ACTION = "rfq_award.rejected";

  private final RfqMapper rfqMapper;
  private final QuoteMapper quoteMapper;
  private final AwardDecisionMapper awardDecisionMapper;
  private final ApprovalTaskMapper approvalTaskMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public AwardApplicationService(
      RfqMapper rfqMapper,
      QuoteMapper quoteMapper,
      AwardDecisionMapper awardDecisionMapper,
      ApprovalTaskMapper approvalTaskMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.rfqMapper = rfqMapper;
    this.quoteMapper = quoteMapper;
    this.awardDecisionMapper = awardDecisionMapper;
    this.approvalTaskMapper = approvalTaskMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  @Transactional
  public AwardDecisionResponse award(String rfqId, AwardRfqRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer award APIs");
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    if (!QUOTING_RFQ_STATUS.equals(rfq.status())) {
      throw new IllegalStateException("Only quoting RFQs can be awarded: " + rfqId);
    }

    Quote quote = quoteMapper.findSubmittedQuoteForAward(tenantId, rfqId, request.quoteId(), SUBMITTED_QUOTE_STATUS);
    if (quote == null) {
      throw new IllegalStateException("Award requires a submitted quote: " + request.quoteId());
    }

    int updated = rfqMapper.updateStatus(
        tenantId,
        rfqId,
        QUOTING_RFQ_STATUS,
        AWARD_APPROVAL_RFQ_STATUS);
    if (updated == 0) {
      throw new IllegalStateException("RFQ status changed before award approval could be submitted: " + rfqId);
    }

    String awardId = newId("award");
    awardDecisionMapper.insert(
        awardId,
        tenantId,
        rfqId,
        quote.id(),
        quote.supplierId(),
        quote.amount(),
        request.reason(),
        PENDING_APPROVAL_STATUS);

    approvalTaskMapper.insert(
        newId("approval"),
        tenantId,
        RFQ_AWARD_BIZ_TYPE,
        awardId,
        null,
        PENDING_APPROVAL_STATUS);
    auditLogApplicationService.recordTenantAction(RFQ_AWARD_SUBMITTED_ACTION, RFQ_AWARD_BIZ_TYPE, awardId);

    return toResponse(awardDecisionMapper.findByTenantAndId(tenantId, awardId));
  }

  @Transactional
  public AwardDecisionResponse reviewApproval(String rfqId, ReviewAwardApprovalRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer award APIs");
    String userId = TenantAccessGuard.requireUserId("buyer award APIs");
    AwardDecision awardDecision = awardDecisionMapper.findByTenantAndId(tenantId, request.awardId());
    if (awardDecision == null || !rfqId.equals(awardDecision.rfqId())) {
      throw new IllegalArgumentException("Pending award decision not found in RFQ scope: " + request.awardId());
    }
    if (!PENDING_APPROVAL_STATUS.equals(awardDecision.approvedStatus())) {
      throw new IllegalStateException("Only pending award decisions can be reviewed: " + request.awardId());
    }

    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    if (!AWARD_APPROVAL_RFQ_STATUS.equals(rfq.status())) {
      throw new IllegalStateException("Only RFQs in award approval can be reviewed: " + rfqId);
    }

    ApprovalTask approvalTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        RFQ_AWARD_BIZ_TYPE,
        request.awardId(),
        PENDING_APPROVAL_STATUS);
    if (approvalTask == null) {
      throw new IllegalStateException("Pending approval task not found for RFQ award: " + request.awardId());
    }

    String approvalStatus = Boolean.TRUE.equals(request.approved()) ? APPROVED_STATUS : REJECTED_STATUS;
    int approvalUpdated = approvalTaskMapper.updateStatus(
        tenantId,
        approvalTask.id(),
        PENDING_APPROVAL_STATUS,
        approvalStatus,
        userId);
    if (approvalUpdated == 0) {
      throw new IllegalStateException("Approval task status changed before review could be recorded: " + approvalTask.id());
    }

    int awardUpdated = awardDecisionMapper.updateApprovedStatus(
        tenantId,
        request.awardId(),
        PENDING_APPROVAL_STATUS,
        approvalStatus);
    if (awardUpdated == 0) {
      throw new IllegalStateException("Award decision status changed before review could be applied: " + request.awardId());
    }

    if (Boolean.TRUE.equals(request.approved())) {
      int rfqUpdated = rfqMapper.updateAward(
          tenantId,
          rfqId,
          AWARD_APPROVAL_RFQ_STATUS,
          AWARDED_RFQ_STATUS,
          awardDecision.supplierId());
      if (rfqUpdated == 0) {
        throw new IllegalStateException("RFQ status changed before award could be finalized: " + rfqId);
      }
    } else {
      int rfqUpdated = rfqMapper.updateStatus(
          tenantId,
          rfqId,
          AWARD_APPROVAL_RFQ_STATUS,
          QUOTING_RFQ_STATUS);
      if (rfqUpdated == 0) {
        throw new IllegalStateException("RFQ status changed before award rejection could be applied: " + rfqId);
      }
    }
    auditLogApplicationService.recordTenantAction(
        Boolean.TRUE.equals(request.approved()) ? RFQ_AWARD_APPROVED_ACTION : RFQ_AWARD_REJECTED_ACTION,
        RFQ_AWARD_BIZ_TYPE,
        request.awardId());

    return toResponse(awardDecisionMapper.findByTenantAndId(tenantId, request.awardId()));
  }

  private AwardDecisionResponse toResponse(AwardDecision awardDecision) {
    return new AwardDecisionResponse(
        awardDecision.id(),
        awardDecision.tenantId(),
        awardDecision.rfqId(),
        awardDecision.quoteId(),
        awardDecision.supplierId(),
        awardDecision.amount(),
        awardDecision.reason(),
        awardDecision.approvedStatus(),
        awardDecision.createdAt());
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }
}
