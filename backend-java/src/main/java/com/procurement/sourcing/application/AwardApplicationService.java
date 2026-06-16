package com.procurement.sourcing.application;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.domain.ApprovalBusinessType;
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
import com.procurement.sourcing.domain.RfqAwardAuditAction;
import com.procurement.sourcing.domain.RfqAwardStatusTransition;
import com.procurement.sourcing.domain.RfqStatus;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AwardApplicationService {
  private final RfqMapper rfqMapper;
  private final QuoteMapper quoteMapper;
  private final AwardDecisionMapper awardDecisionMapper;
  private final ApprovalTaskMapper approvalTaskMapper;
  private final ApprovalTaskApplicationService approvalTaskApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final RfqAwardStatusTransition rfqAwardStatusTransition;

  public AwardApplicationService(
      RfqMapper rfqMapper,
      QuoteMapper quoteMapper,
      AwardDecisionMapper awardDecisionMapper,
      ApprovalTaskMapper approvalTaskMapper,
      ApprovalTaskApplicationService approvalTaskApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      RfqAwardStatusTransition rfqAwardStatusTransition) {
    this.rfqMapper = rfqMapper;
    this.quoteMapper = quoteMapper;
    this.awardDecisionMapper = awardDecisionMapper;
    this.approvalTaskMapper = approvalTaskMapper;
    this.approvalTaskApplicationService = approvalTaskApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.rfqAwardStatusTransition = rfqAwardStatusTransition;
  }

  @Transactional
  public AwardDecisionResponse award(String rfqId, AwardRfqRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer award APIs");
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    rfqAwardStatusTransition.requireAwardSubmission(rfq.status(), rfqId);

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
        ApprovalStatus.PENDING);

    approvalTaskApplicationService.createPendingTask(
        tenantId,
        ApprovalBusinessType.RFQ_AWARD,
        awardId,
        null);
    auditLogApplicationService.recordTenantAction(
        RfqAwardAuditAction.SUBMITTED,
        ApprovalBusinessType.RFQ_AWARD,
        awardId);
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        NotificationTitle.RFQ_AWARD_PENDING_APPROVAL,
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
    if (!ApprovalStatus.PENDING.equals(awardDecision.approvedStatus())) {
      throw new IllegalStateException("Only pending award decisions can be reviewed: " + request.awardId());
    }

    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    rfqAwardStatusTransition.requireAwardReview(rfq.status(), rfqId);

    ApprovalTask approvalTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        ApprovalBusinessType.RFQ_AWARD,
        request.awardId(),
        ApprovalStatus.PENDING);
    if (approvalTask == null) {
      throw new IllegalStateException("Pending approval task not found for RFQ award: " + request.awardId());
    }

    String approvalStatus = Boolean.TRUE.equals(request.approved()) ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
    int approvalUpdated = approvalTaskMapper.updateStatus(
        tenantId,
        approvalTask.id(),
        ApprovalStatus.PENDING,
        approvalStatus,
        userId);
    if (approvalUpdated == 0) {
      throw new IllegalStateException("Approval task status changed before review could be recorded: " + approvalTask.id());
    }

    int awardUpdated = awardDecisionMapper.updateApprovedStatus(
        tenantId,
        request.awardId(),
        ApprovalStatus.PENDING,
        approvalStatus);
    if (awardUpdated == 0) {
      throw new IllegalStateException("Award decision status changed before review could be applied: " + request.awardId());
    }

    boolean approved = Boolean.TRUE.equals(request.approved());
    String targetRfqStatus = rfqAwardStatusTransition.reviewTargetStatus(approved);
    if (approved) {
      int rfqUpdated = rfqMapper.updateAward(
          tenantId,
          rfqId,
          RfqStatus.AWARD_APPROVAL,
          targetRfqStatus,
          awardDecision.supplierId());
      if (rfqUpdated == 0) {
        throw new IllegalStateException("RFQ status changed before award could be finalized: " + rfqId);
      }
    } else {
      int rfqUpdated = rfqMapper.updateStatus(
          tenantId,
          rfqId,
          RfqStatus.AWARD_APPROVAL,
          targetRfqStatus);
      if (rfqUpdated == 0) {
        throw new IllegalStateException("RFQ status changed before award rejection could be applied: " + rfqId);
      }
    }
    auditLogApplicationService.recordTenantAction(
        Boolean.TRUE.equals(request.approved()) ? RfqAwardAuditAction.APPROVED : RfqAwardAuditAction.REJECTED,
        ApprovalBusinessType.RFQ_AWARD,
        request.awardId());
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        Boolean.TRUE.equals(request.approved())
            ? NotificationTitle.RFQ_AWARD_APPROVED
            : NotificationTitle.RFQ_AWARD_REJECTED,
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
