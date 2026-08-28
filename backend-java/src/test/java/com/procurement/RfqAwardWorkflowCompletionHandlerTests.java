package com.procurement;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.sourcing.application.RfqAwardWorkflowCompletionHandler;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.QuoteStatus;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqAwardAuditAction;
import com.procurement.sourcing.domain.RfqStatus;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import com.procurement.workflow.domain.WorkflowInstanceStatus;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class RfqAwardWorkflowCompletionHandlerTests {

  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final QuoteMapper quoteMapper = org.mockito.Mockito.mock(QuoteMapper.class);
  private final AwardDecisionMapper awardDecisionMapper = org.mockito.Mockito.mock(AwardDecisionMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final RfqAwardWorkflowCompletionHandler handler = new RfqAwardWorkflowCompletionHandler(
      rfqMapper,
      quoteMapper,
      awardDecisionMapper,
      auditLogApplicationService,
      notificationApplicationService);

  @Test
  void approvalFinalizesAwardAndNotifiesAllQuotedSuppliers() {
    AwardDecision decision = decision();
    Rfq rfq = rfq();
    when(awardDecisionMapper.findByTenantAndId("tenant-1", decision.id())).thenReturn(decision);
    when(rfqMapper.findByTenantAndId("tenant-1", rfq.id())).thenReturn(rfq);
    when(awardDecisionMapper.updateApprovedStatus(
        "tenant-1", decision.id(), ApprovalStatus.PENDING, ApprovalStatus.APPROVED)).thenReturn(1);
    when(rfqMapper.updateAward(
        "tenant-1", rfq.id(), RfqStatus.AWARD_APPROVAL, RfqStatus.AWARDED, decision.supplierId()))
        .thenReturn(1);
    when(quoteMapper.markAwardedQuote(
        "tenant-1", decision.quoteId(), QuoteStatus.LOCKED, QuoteStatus.AWARDED)).thenReturn(1);
    when(quoteMapper.listByTenantAndRfq("tenant-1", rfq.id())).thenReturn(List.of(
        quote(decision.quoteId(), decision.supplierId()),
        quote("quote-other", "supplier-other")));

    handler.onCompleted(workflowInstance(), new WorkflowCompletion(
        true, "reviewer-1", "评审结论与定标依据一致"));

    verify(quoteMapper).closeUnawardedQuotes(
        "tenant-1", rfq.id(), decision.quoteId(), QuoteStatus.SUBMITTED, QuoteStatus.NOT_SELECTED);
    verify(auditLogApplicationService).recordTenantAction(
        "tenant-1",
        RfqAwardAuditAction.APPROVED,
        ApprovalBusinessType.RFQ_AWARD,
        decision.id(),
        "评审结论与定标依据一致");
    verify(notificationApplicationService).notifyActiveTenantUsers(
        "tenant-1", NotificationTitle.RFQ_AWARD_APPROVED, "办公电脑询价定标审批已通过。");
    verify(notificationApplicationService).notifyActiveSupplierUsers(
        "tenant-1", decision.supplierId(), NotificationTitle.QUOTE_AWARDED,
        "办公电脑询价定标审批已通过，贵司报价已中选。");
    verify(notificationApplicationService).notifyActiveSupplierUsers(
        "tenant-1", "supplier-other", NotificationTitle.QUOTE_NOT_SELECTED,
        "办公电脑询价定标审批已通过，贵司报价未中选。");
  }

  @Test
  void rejectionReopensRfqAndUnlocksSelectedQuoteForAnotherDecision() {
    AwardDecision decision = decision();
    Rfq rfq = rfq();
    when(awardDecisionMapper.findByTenantAndId("tenant-1", decision.id())).thenReturn(decision);
    when(rfqMapper.findByTenantAndId("tenant-1", rfq.id())).thenReturn(rfq);
    when(awardDecisionMapper.updateApprovedStatus(
        "tenant-1", decision.id(), ApprovalStatus.PENDING, ApprovalStatus.REJECTED)).thenReturn(1);
    when(rfqMapper.updateStatus(
        "tenant-1", rfq.id(), RfqStatus.AWARD_APPROVAL, RfqStatus.OPENED)).thenReturn(1);
    when(quoteMapper.unlockAwardQuote(
        "tenant-1", decision.quoteId(), QuoteStatus.LOCKED, QuoteStatus.SUBMITTED)).thenReturn(1);

    handler.onCompleted(workflowInstance(), new WorkflowCompletion(
        false, "reviewer-1", "交付承诺不满足要求"));

    verify(quoteMapper).unlockAwardQuote(
        "tenant-1", decision.quoteId(), QuoteStatus.LOCKED, QuoteStatus.SUBMITTED);
    verify(rfqMapper, never()).updateAward(
        "tenant-1", rfq.id(), RfqStatus.AWARD_APPROVAL, RfqStatus.AWARDED, decision.supplierId());
    verify(quoteMapper, never()).markAwardedQuote(
        "tenant-1", decision.quoteId(), QuoteStatus.LOCKED, QuoteStatus.AWARDED);
    verify(auditLogApplicationService).recordTenantAction(
        "tenant-1",
        RfqAwardAuditAction.REJECTED,
        ApprovalBusinessType.RFQ_AWARD,
        decision.id(),
        "交付承诺不满足要求");
    verify(notificationApplicationService).notifyActiveTenantUsers(
        "tenant-1", NotificationTitle.RFQ_AWARD_REJECTED, "办公电脑询价定标审批已驳回。");
  }

  private WorkflowBusinessInstance workflowInstance() {
    OffsetDateTime now = OffsetDateTime.parse("2026-08-26T10:00:00+08:00");
    return new WorkflowBusinessInstance(
        "workflow-1",
        "tenant-1",
        ApprovalBusinessType.RFQ_AWARD,
        "award-1",
        "workflow-def-v1",
        "flowable-1",
        WorkflowInstanceStatus.PROCESSING,
        "requester-1",
        "dept-1",
        new BigDecimal("118000"),
        "{}",
        "{}",
        null,
        null,
        now,
        now);
  }

  private AwardDecision decision() {
    return new AwardDecision(
        "award-1",
        "tenant-1",
        "rfq-1",
        "quote-selected",
        "supplier-selected",
        new BigDecimal("118000"),
        "含税总价与交期综合最优",
        ApprovalStatus.PENDING,
        OffsetDateTime.parse("2026-08-26T10:00:00+08:00"));
  }

  private Rfq rfq() {
    OffsetDateTime now = OffsetDateTime.parse("2026-08-26T10:00:00+08:00");
    return new Rfq(
        "rfq-1",
        "tenant-1",
        "办公电脑询价",
        RfqStatus.AWARD_APPROVAL,
        OffsetDateTime.parse("2026-09-10T18:00:00+08:00"),
        "requester-1",
        null,
        now,
        now,
        "含税总价",
        "十日内交付",
        "综合评分法",
        now,
        1,
        false,
        "询比",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null);
  }

  private Quote quote(String id, String supplierId) {
    return new Quote(
        id,
        "tenant-1",
        "rfq-1",
        supplierId,
        new BigDecimal("118000"),
        new BigDecimal("13"),
        10,
        QuoteStatus.SUBMITTED,
        OffsetDateTime.parse("2026-08-26T10:00:00+08:00"));
  }
}
