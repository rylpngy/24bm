package com.procurement.sourcing.application;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.QuoteStatus;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqAwardAuditAction;
import com.procurement.sourcing.domain.RfqStatus;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.workflow.application.WorkflowBusinessCompletionHandler;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public class RfqAwardWorkflowCompletionHandler implements WorkflowBusinessCompletionHandler {
  private final RfqMapper rfqMapper;
  private final QuoteMapper quoteMapper;
  private final AwardDecisionMapper awardDecisionMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public RfqAwardWorkflowCompletionHandler(
      RfqMapper rfqMapper,
      QuoteMapper quoteMapper,
      AwardDecisionMapper awardDecisionMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.rfqMapper = rfqMapper;
    this.quoteMapper = quoteMapper;
    this.awardDecisionMapper = awardDecisionMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  @Override
  public String businessType() {
    return ApprovalBusinessType.RFQ_AWARD;
  }

  @Override
  public void onCompleted(WorkflowBusinessInstance instance, WorkflowCompletion completion) {
    AwardDecision decision = awardDecisionMapper.findByTenantAndId(instance.tenantId(), instance.businessId());
    if (decision == null || !ApprovalStatus.PENDING.equals(decision.approvedStatus())) {
      throw new IllegalStateException("Award decision is not awaiting workflow approval: " + instance.businessId());
    }
    Rfq rfq = rfqMapper.findByTenantAndId(instance.tenantId(), decision.rfqId());
    if (rfq == null || !RfqStatus.AWARD_APPROVAL.equals(rfq.status())) {
      throw new IllegalStateException("RFQ is not awaiting award workflow approval: " + decision.rfqId());
    }
    String decisionStatus = completion.approved() ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
    if (awardDecisionMapper.updateApprovedStatus(
        instance.tenantId(), decision.id(), ApprovalStatus.PENDING, decisionStatus) == 0) {
      throw new IllegalStateException("Award decision changed before workflow outcome could be applied: " + decision.id());
    }
    if (completion.approved()) {
      if (rfqMapper.updateAward(
          instance.tenantId(),
          rfq.id(),
          RfqStatus.AWARD_APPROVAL,
          RfqStatus.AWARDED,
          decision.supplierId()) == 0) {
        throw new IllegalStateException("RFQ changed before award workflow could be finalized: " + rfq.id());
      }
      if (quoteMapper.markAwardedQuote(
          instance.tenantId(), decision.quoteId(), QuoteStatus.LOCKED, QuoteStatus.AWARDED) == 0) {
        throw new IllegalStateException("Selected quote changed before workflow could be finalized: " + decision.quoteId());
      }
      quoteMapper.closeUnawardedQuotes(
          instance.tenantId(), rfq.id(), decision.quoteId(), QuoteStatus.SUBMITTED, QuoteStatus.NOT_SELECTED);
      notifySupplierAwardResults(instance.tenantId(), rfq, decision);
    } else {
      if (rfqMapper.updateStatus(
          instance.tenantId(), rfq.id(), RfqStatus.AWARD_APPROVAL, RfqStatus.OPENED) == 0) {
        throw new IllegalStateException("RFQ changed before award rejection could be applied: " + rfq.id());
      }
      if (quoteMapper.unlockAwardQuote(
          instance.tenantId(), decision.quoteId(), QuoteStatus.LOCKED, QuoteStatus.SUBMITTED) == 0) {
        throw new IllegalStateException("Selected quote changed before award rejection could be applied: " + decision.quoteId());
      }
    }
    auditLogApplicationService.recordTenantAction(
        instance.tenantId(),
        completion.approved() ? RfqAwardAuditAction.APPROVED : RfqAwardAuditAction.REJECTED,
        ApprovalBusinessType.RFQ_AWARD,
        decision.id(),
        completion.comment());
    notificationApplicationService.notifyActiveTenantUsers(
        instance.tenantId(),
        completion.approved() ? NotificationTitle.RFQ_AWARD_APPROVED : NotificationTitle.RFQ_AWARD_REJECTED,
        rfq.title() + "定标审批已" + (completion.approved() ? "通过" : "驳回") + "。");
  }

  private void notifySupplierAwardResults(String tenantId, Rfq rfq, AwardDecision decision) {
    notificationApplicationService.notifyActiveSupplierUsers(
        tenantId,
        decision.supplierId(),
        NotificationTitle.QUOTE_AWARDED,
        rfq.title() + "定标审批已通过，贵司报价已中选。");
    quoteMapper.listByTenantAndRfq(tenantId, rfq.id()).stream()
        .map(Quote::supplierId)
        .filter(supplierId -> !decision.supplierId().equals(supplierId))
        .distinct()
        .forEach(supplierId -> notificationApplicationService.notifyActiveSupplierUsers(
            tenantId,
            supplierId,
            NotificationTitle.QUOTE_NOT_SELECTED,
            rfq.title() + "定标审批已通过，贵司报价未中选。"));
  }
}
