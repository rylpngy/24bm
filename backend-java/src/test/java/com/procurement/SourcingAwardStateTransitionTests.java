package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.sourcing.api.AwardDecisionResponse;
import com.procurement.sourcing.api.AwardRfqRequest;
import com.procurement.sourcing.api.ReviewAwardApprovalRequest;
import com.procurement.sourcing.application.AwardApplicationService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class SourcingAwardStateTransitionTests {

  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final QuoteMapper quoteMapper = org.mockito.Mockito.mock(QuoteMapper.class);
  private final AwardDecisionMapper awardDecisionMapper = org.mockito.Mockito.mock(AwardDecisionMapper.class);
  private final ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
  private final AuditLogApplicationService auditLogApplicationService = org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final AwardApplicationService awardApplicationService = new AwardApplicationService(
      rfqMapper,
      quoteMapper,
      awardDecisionMapper,
      approvalTaskMapper,
      auditLogApplicationService,
      notificationApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void awardRejectsRfqThatIsNoLongerQuoting() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "已定标"));

    assertThatThrownBy(() -> awardApplicationService.award("rfq-1", new AwardRfqRequest("quote-1", "最低价")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only quoting RFQs can be awarded");
  }

  @Test
  void awardFailsWhenRfqStatusChangesBeforeAtomicUpdate() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "报价中"));
    when(quoteMapper.findSubmittedQuoteForAward("tenant-1", "rfq-1", "quote-1", "已提交"))
        .thenReturn(quote("quote-1", "tenant-1", "rfq-1", "supplier-1"));
    when(rfqMapper.updateStatus("tenant-1", "rfq-1", "报价中", "定标审批中"))
        .thenReturn(0);

    assertThatThrownBy(() -> awardApplicationService.award("rfq-1", new AwardRfqRequest("quote-1", "最低价")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("RFQ status changed before award approval could be submitted");

    verify(awardDecisionMapper, never()).insert(
        anyString(),
        anyString(),
        anyString(),
        anyString(),
        anyString(),
        org.mockito.ArgumentMatchers.any(),
        anyString(),
        anyString());
  }

  @Test
  void awardSubmitsPendingApprovalBeforeFinalAward() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "报价中"));
    when(quoteMapper.findSubmittedQuoteForAward("tenant-1", "rfq-1", "quote-1", "已提交"))
        .thenReturn(quote("quote-1", "tenant-1", "rfq-1", "supplier-1"));
    when(rfqMapper.updateStatus("tenant-1", "rfq-1", "报价中", "定标审批中"))
        .thenReturn(1);
    when(awardDecisionMapper.findByTenantAndId(org.mockito.ArgumentMatchers.eq("tenant-1"), org.mockito.ArgumentMatchers.any()))
        .thenReturn(awardDecision("award-1", "tenant-1", "rfq-1", "quote-1", "supplier-1", "待审批"));
    when(approvalTaskMapper.findByTenantAndId(org.mockito.ArgumentMatchers.eq("tenant-1"), org.mockito.ArgumentMatchers.any()))
        .thenReturn(task("approval-1", "tenant-1", "award-1", "待审批"));

    AwardDecisionResponse response = awardApplicationService.award("rfq-1", new AwardRfqRequest("quote-1", "最低价"));

    assertThat(response.approvedStatus()).isEqualTo("待审批");
    verify(awardDecisionMapper).insert(
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("rfq-1"),
        org.mockito.ArgumentMatchers.eq("quote-1"),
        org.mockito.ArgumentMatchers.eq("supplier-1"),
        org.mockito.ArgumentMatchers.eq(BigDecimal.valueOf(100)),
        org.mockito.ArgumentMatchers.eq("最低价"),
        org.mockito.ArgumentMatchers.eq("待审批"));
    verify(approvalTaskMapper).insert(
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("rfq_award"),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.eq("待审批"));
    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("rfq_award.submitted"),
        org.mockito.ArgumentMatchers.eq("rfq_award"),
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("award-")));
    verify(rfqMapper, never()).updateAward("tenant-1", "rfq-1", "定标审批中", "已定标", "supplier-1");
  }

  @Test
  void awardApprovalApprovesPendingDecisionAndFinalizesRfqAward() {
    TenantContext.set("tenant-1", null, "approver-1");
    when(awardDecisionMapper.findByTenantAndId("tenant-1", "award-1"))
        .thenReturn(awardDecision("award-1", "tenant-1", "rfq-1", "quote-1", "supplier-1", "待审批"));
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "定标审批中"));
    when(approvalTaskMapper.findPendingByBiz("tenant-1", "rfq_award", "award-1", "待审批"))
        .thenReturn(task("approval-1", "tenant-1", "award-1", "待审批"));
    when(approvalTaskMapper.updateStatus("tenant-1", "approval-1", "待审批", "已通过", "approver-1"))
        .thenReturn(1);
    when(awardDecisionMapper.updateApprovedStatus("tenant-1", "award-1", "待审批", "已通过"))
        .thenReturn(1);
    when(rfqMapper.updateAward("tenant-1", "rfq-1", "定标审批中", "已定标", "supplier-1"))
        .thenReturn(1);
    when(awardDecisionMapper.findByTenantAndId("tenant-1", "award-1"))
        .thenReturn(awardDecision("award-1", "tenant-1", "rfq-1", "quote-1", "supplier-1", "待审批"))
        .thenReturn(awardDecision("award-1", "tenant-1", "rfq-1", "quote-1", "supplier-1", "已通过"));

    AwardDecisionResponse response = awardApplicationService.reviewApproval(
        "rfq-1",
        new ReviewAwardApprovalRequest("award-1", true));

    assertThat(response.approvedStatus()).isEqualTo("已通过");
    verify(rfqMapper).updateAward("tenant-1", "rfq-1", "定标审批中", "已定标", "supplier-1");
    verify(auditLogApplicationService).recordTenantAction("rfq_award.approved", "rfq_award", "award-1");
  }

  private Rfq rfq(String id, String tenantId, String status) {
    return new Rfq(
        id,
        tenantId,
        "办公电脑询价",
        status,
        OffsetDateTime.parse("2026-06-20T18:00:00+08:00"),
        "buyer-user",
        null,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }

  private Quote quote(String id, String tenantId, String rfqId, String supplierId) {
    return new Quote(
        id,
        tenantId,
        rfqId,
        supplierId,
        BigDecimal.valueOf(100),
        BigDecimal.valueOf(13),
        7,
        "已提交",
        OffsetDateTime.parse("2026-06-15T11:00:00+08:00"));
  }

  private AwardDecision awardDecision(
      String id,
      String tenantId,
      String rfqId,
      String quoteId,
      String supplierId,
      String approvedStatus) {
    return new AwardDecision(
        id,
        tenantId,
        rfqId,
        quoteId,
        supplierId,
        BigDecimal.valueOf(100),
        "最低价",
        approvedStatus,
        OffsetDateTime.parse("2026-06-15T11:30:00+08:00"));
  }

  private ApprovalTask task(String id, String tenantId, String awardId, String status) {
    return new ApprovalTask(
        id,
        tenantId,
        "rfq_award",
        awardId,
        "approver-1",
        status,
        OffsetDateTime.parse("2026-06-15T11:35:00+08:00"));
  }
}
