package com.procurement.sourcing.application;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.application.ApprovalGate;
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
import com.procurement.sourcing.domain.RfqMethod;
import com.procurement.sourcing.domain.RfqStatus;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowStartCommand;
import java.util.UUID;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AwardApplicationService {
  private final RfqMapper rfqMapper;
  private final QuoteMapper quoteMapper;
  private final AwardDecisionMapper awardDecisionMapper;
  private final ApprovalTaskMapper approvalTaskMapper;
  private final ApprovalTaskApplicationService approvalTaskApplicationService;
  private final ApprovalGate approvalGate;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final RfqAwardStatusTransition rfqAwardStatusTransition;
  private RfqApplicationService rfqAccess;
  private UnifiedWorkflowApplicationService unifiedWorkflowApplicationService;

  public AwardApplicationService(
      RfqMapper rfqMapper,
      QuoteMapper quoteMapper,
      AwardDecisionMapper awardDecisionMapper,
      ApprovalTaskMapper approvalTaskMapper,
      ApprovalTaskApplicationService approvalTaskApplicationService,
      ApprovalGate approvalGate,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      RfqAwardStatusTransition rfqAwardStatusTransition) {
    this.rfqMapper = rfqMapper;
    this.quoteMapper = quoteMapper;
    this.awardDecisionMapper = awardDecisionMapper;
    this.approvalTaskMapper = approvalTaskMapper;
    this.approvalTaskApplicationService = approvalTaskApplicationService;
    this.approvalGate = approvalGate;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.rfqAwardStatusTransition = rfqAwardStatusTransition;
  }

  @Autowired
  public void setRfqAccess(RfqApplicationService rfqAccess) {
    this.rfqAccess = java.util.Objects.requireNonNull(rfqAccess);
  }

  @Autowired
  void setUnifiedWorkflowApplicationService(
      UnifiedWorkflowApplicationService unifiedWorkflowApplicationService) {
    this.unifiedWorkflowApplicationService = unifiedWorkflowApplicationService;
  }

  @Transactional
  public AwardDecisionResponse award(String rfqId, AwardRfqRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer award APIs");
    rfqAccess.requireWriteAccess(rfqId);
    rfqMapper.lockByTenantAndId(tenantId, rfqId);
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    rfqAwardStatusTransition.requireAwardSubmission(rfq.status(), rfqId);
    // 采购方式差异化定标门槛:竞争性谈判须多轮、招标/询价须法定家数。
    int bidderCount = quoteMapper.listByTenantAndRfqAndRound(tenantId, rfqId, rfq.currentRound()).size();
    RfqMethod.requireAwardEligible(rfq.method(), rfq.currentRound(), bidderCount, rfqId);
    // 家数不足参考门槛:不阻断(民企/非依法必招项目可继续),但强制审计留痕。
    String quorumAdvisory = RfqMethod.awardQuorumAdvisory(rfq.method(), bidderCount);
    if (quorumAdvisory != null) {
      auditLogApplicationService.recordTenantAction(
          tenantId, "rfq.award_quorum_shortfall", "rfq", rfqId, quorumAdvisory);
    }

    Quote quote = quoteMapper.findSubmittedQuoteForAward(tenantId, rfqId, request.quoteId(), QuoteStatus.SUBMITTED);
    if (quote == null) {
      throw new IllegalStateException("Award requires a submitted quote: " + request.quoteId());
    }
    rfqAccess.requireAwardSupplier(rfq, quote.supplierId());

    int updated = rfqMapper.updateStatus(
        tenantId,
        rfqId,
        RfqStatus.OPENED,
        RfqStatus.AWARD_APPROVAL);
    if (updated == 0) {
      throw new IllegalStateException("RFQ status changed before award approval could be submitted: " + rfqId);
    }
    int lockedQuote = quoteMapper.lockSubmittedQuoteForAward(
        tenantId,
        quote.id(),
        QuoteStatus.SUBMITTED,
        QuoteStatus.LOCKED);
    if (lockedQuote == 0) {
      throw new IllegalStateException("Selected quote changed before award approval could be submitted: " + quote.id());
    }

    String awardId = newId("award");
    boolean requiresApproval = unifiedWorkflowApplicationService != null
        || approvalGate.requiresApproval(tenantId, ApprovalBusinessType.RFQ_AWARD);
    awardDecisionMapper.insert(
        awardId,
        tenantId,
        rfqId,
        quote.id(),
        quote.supplierId(),
        quote.amount(),
        request.reason(),
        requiresApproval ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED);

    if (unifiedWorkflowApplicationService != null) {
      unifiedWorkflowApplicationService.start(new WorkflowStartCommand(
          ApprovalBusinessType.RFQ_AWARD,
          awardId,
          null,
          quote.amount(),
          request.formData() == null ? Map.of() : request.formData(),
          Map.of(
              "rfqId", rfqId,
              "quoteId", quote.id(),
              "supplierId", quote.supplierId(),
              "amount", quote.amount())));
      auditLogApplicationService.recordTenantAction(
          RfqAwardAuditAction.SUBMITTED,
          ApprovalBusinessType.RFQ_AWARD,
          awardId);
      notificationApplicationService.notifyActiveTenantUsers(
          tenantId,
          NotificationTitle.RFQ_AWARD_PENDING_APPROVAL,
          rfq.title() + "已提交定标审批，请及时处理。");
    } else if (requiresApproval) {
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
    } else {
      // 免审直通:定标审批节点已关闭,直接完成定标(状态机与审批通过路径一致)。
      int rfqUpdated = rfqMapper.updateAward(
          tenantId,
          rfqId,
          RfqStatus.AWARD_APPROVAL,
          rfqAwardStatusTransition.reviewTargetStatus(true),
          quote.supplierId());
      if (rfqUpdated == 0) {
        throw new IllegalStateException("RFQ status changed before award could be finalized: " + rfqId);
      }
      int awardedQuote = quoteMapper.markAwardedQuote(
          tenantId, quote.id(), QuoteStatus.LOCKED, QuoteStatus.AWARDED);
      if (awardedQuote == 0) {
        throw new IllegalStateException("Selected quote changed before award could be finalized: " + quote.id());
      }
      quoteMapper.closeUnawardedQuotes(tenantId, rfqId, quote.id(), QuoteStatus.SUBMITTED, QuoteStatus.NOT_SELECTED);
      auditLogApplicationService.recordTenantAction(
          tenantId, RfqAwardAuditAction.SUBMITTED, ApprovalBusinessType.RFQ_AWARD, awardId,
          ApprovalGate.bypassDetail());
      notifySupplierAwardResults(tenantId, rfq, awardDecisionMapper.findByTenantAndId(tenantId, awardId));
    }

    return toResponse(awardDecisionMapper.findByTenantAndId(tenantId, awardId));
  }

  @Transactional
  public AwardDecisionResponse reviewApproval(String rfqId, ReviewAwardApprovalRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer award APIs");
    rfqAccess.requireWriteAccess(rfqId);
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

    if (unifiedWorkflowApplicationService != null) {
      unifiedWorkflowApplicationService.completeCurrentUserBusinessTask(
          ApprovalBusinessType.RFQ_AWARD,
          request.awardId(),
          Boolean.TRUE.equals(request.approved()),
          request.comment());
      return toResponse(awardDecisionMapper.findByTenantAndId(tenantId, request.awardId()));
    }

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
        userId,
        request.comment());
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
      int awardedQuote = quoteMapper.markAwardedQuote(
          tenantId,
          awardDecision.quoteId(),
          QuoteStatus.LOCKED,
          QuoteStatus.AWARDED);
      if (awardedQuote == 0) {
        throw new IllegalStateException("Selected quote changed before award could be finalized: " + awardDecision.quoteId());
      }
      quoteMapper.closeUnawardedQuotes(
          tenantId,
          rfqId,
          awardDecision.quoteId(),
          QuoteStatus.SUBMITTED,
          QuoteStatus.NOT_SELECTED);
      notifySupplierAwardResults(tenantId, rfq, awardDecision);
    } else {
      int rfqUpdated = rfqMapper.updateStatus(
          tenantId,
          rfqId,
          RfqStatus.AWARD_APPROVAL,
          targetRfqStatus);
      if (rfqUpdated == 0) {
        throw new IllegalStateException("RFQ status changed before award rejection could be applied: " + rfqId);
      }
      int unlockedQuote = quoteMapper.unlockAwardQuote(
          tenantId,
          awardDecision.quoteId(),
          QuoteStatus.LOCKED,
          QuoteStatus.SUBMITTED);
      if (unlockedQuote == 0) {
        throw new IllegalStateException("Selected quote changed before award rejection could be applied: " + awardDecision.quoteId());
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

  private void notifySupplierAwardResults(String tenantId, Rfq rfq, AwardDecision awardDecision) {
    notificationApplicationService.notifyActiveSupplierUsers(
        tenantId,
        awardDecision.supplierId(),
        NotificationTitle.QUOTE_AWARDED,
        rfq.title() + "定标审批已通过，贵司报价已中选。");
    quoteMapper.listByTenantAndRfq(tenantId, rfq.id()).stream()
        .map(Quote::supplierId)
        .filter(supplierId -> !awardDecision.supplierId().equals(supplierId))
        .distinct()
        .forEach(supplierId -> notificationApplicationService.notifyActiveSupplierUsers(
            tenantId,
            supplierId,
            NotificationTitle.QUOTE_NOT_SELECTED,
            rfq.title() + "定标审批已通过，贵司报价未中选。"));
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }
}
