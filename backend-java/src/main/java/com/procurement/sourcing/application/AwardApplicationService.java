package com.procurement.sourcing.application;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.sourcing.api.AwardDecisionResponse;
import com.procurement.sourcing.api.AwardRfqRequest;
import com.procurement.sourcing.api.ReviewAwardApprovalRequest;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.QuoteStatus;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqStatus;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.notification.application.NotificationApplicationService;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AwardApplicationService {
  private static final String RFQ_AWARD_BIZ_TYPE = "rfq_award";
  private static final String RFQ_AWARD_SUBMITTED_ACTION = "rfq_award.submitted";
  private static final String RFQ_AWARD_APPROVED_ACTION = "rfq_award.approved";
  private static final String RFQ_AWARD_REJECTED_ACTION = "rfq_award.rejected";
  private static final String RFQ_AWARD_PENDING_NOTIFICATION_TITLE = "定标结果待审批";
  private static final String RFQ_AWARD_APPROVED_NOTIFICATION_TITLE = "定标审批已通过";
  private static final String RFQ_AWARD_REJECTED_NOTIFICATION_TITLE = "定标审批已驳回";

  private final RfqMapper rfqMapper;
  private final QuoteMapper quoteMapper;
  private final AwardDecisionMapper awardDecisionMapper;
  private final ApprovalTaskMapper approvalTaskMapper;
  private final ApprovalTaskApplicationService approvalTaskApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public AwardApplicationService(
      RfqMapper rfqMapper,
      QuoteMapper quoteMapper,
      AwardDecisionMapper awardDecisionMapper,
      ApprovalTaskMapper approvalTaskMapper,
      ApprovalTaskApplicationService approvalTaskApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.rfqMapper = rfqMapper;
    this.quoteMapper = quoteMapper;
    this.awardDecisionMapper = awardDecisionMapper;
    this.approvalTaskMapper = approvalTaskMapper;
    this.approvalTaskApplicationService = approvalTaskApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  @Transactional
  public AwardDecisionResponse award(String rfqId, AwardRfqRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer award APIs");
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    if (!RfqStatus.QUOTING.equals(rfq.status())) {
      throw new IllegalStateException("Only quoting RFQs can be awarded: " + rfqId);
    }

    Quote quote = quoteMapper.findSubmittedQuoteForAward(tenantId, rfqId, request.quoteId(), QuoteStatus.SUBMITTED);
    if (quote == null) {
      throw new IllegalStateException("Award requires a submitted quote: " + request.quoteId());
    }

    int updated = rfqMapper.updateStatus(
        tenantId,
        rfqId,
        RfqStatus.QUOTING,
        RfqStatus.AWARD_APPROVAL);
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
        ApprovalTaskApplicationService.PENDING_APPROVAL_STATUS);

    approvalTaskApplicationService.createPendingTask(
        tenantId,
        RFQ_AWARD_BIZ_TYPE,
        awardId,
        null);
    auditLogApplicationService.recordTenantAction(RFQ_AWARD_SUBMITTED_ACTION, RFQ_AWARD_BIZ_TYPE, awardId);
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        RFQ_AWARD_PENDING_NOTIFICATION_TITLE,
        rfq.title() + "已提交定标审批，请及时处理。");

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
    if (!ApprovalTaskApplicationService.PENDING_APPROVAL_STATUS.equals(awardDecision.approvedStatus())) {
      throw new IllegalStateException("Only pending award decisions can be reviewed: " + request.awardId());
    }

    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    if (!RfqStatus.AWARD_APPROVAL.equals(rfq.status())) {
      throw new IllegalStateException("Only RFQs in award approval can be reviewed: " + rfqId);
    }

    ApprovalTask approvalTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        RFQ_AWARD_BIZ_TYPE,
        request.awardId(),
        ApprovalTaskApplicationService.PENDING_APPROVAL_STATUS);
    if (approvalTask == null) {
      throw new IllegalStateException("Pending approval task not found for RFQ award: " + request.awardId());
    }

    String approvalStatus = Boolean.TRUE.equals(request.approved()) ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
    int approvalUpdated = approvalTaskMapper.updateStatus(
        tenantId,
        approvalTask.id(),
        ApprovalTaskApplicationService.PENDING_APPROVAL_STATUS,
        approvalStatus,
        userId);
    if (approvalUpdated == 0) {
      throw new IllegalStateException("Approval task status changed before review could be recorded: " + approvalTask.id());
    }

    int awardUpdated = awardDecisionMapper.updateApprovedStatus(
        tenantId,
        request.awardId(),
        ApprovalTaskApplicationService.PENDING_APPROVAL_STATUS,
        approvalStatus);
    if (awardUpdated == 0) {
      throw new IllegalStateException("Award decision status changed before review could be applied: " + request.awardId());
    }

    if (Boolean.TRUE.equals(request.approved())) {
      int rfqUpdated = rfqMapper.updateAward(
          tenantId,
          rfqId,
          RfqStatus.AWARD_APPROVAL,
          RfqStatus.AWARDED,
          awardDecision.supplierId());
      if (rfqUpdated == 0) {
        throw new IllegalStateException("RFQ status changed before award could be finalized: " + rfqId);
      }
    } else {
      int rfqUpdated = rfqMapper.updateStatus(
          tenantId,
          rfqId,
          RfqStatus.AWARD_APPROVAL,
          RfqStatus.QUOTING);
      if (rfqUpdated == 0) {
        throw new IllegalStateException("RFQ status changed before award rejection could be applied: " + rfqId);
      }
    }
    auditLogApplicationService.recordTenantAction(
        Boolean.TRUE.equals(request.approved()) ? RFQ_AWARD_APPROVED_ACTION : RFQ_AWARD_REJECTED_ACTION,
        RFQ_AWARD_BIZ_TYPE,
        request.awardId());
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        Boolean.TRUE.equals(request.approved())
            ? RFQ_AWARD_APPROVED_NOTIFICATION_TITLE
            : RFQ_AWARD_REJECTED_NOTIFICATION_TITLE,
        rfq.title() + "定标审批已" + (Boolean.TRUE.equals(request.approved()) ? "通过" : "驳回") + "。");

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
