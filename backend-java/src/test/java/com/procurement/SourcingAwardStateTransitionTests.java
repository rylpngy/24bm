package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.domain.ApprovalTemplate;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.sourcing.api.AwardDecisionResponse;
import com.procurement.sourcing.api.AwardRfqRequest;
import com.procurement.sourcing.api.ReviewAwardApprovalRequest;
import com.procurement.sourcing.application.AwardApplicationService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqAwardStatusTransition;
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
  private final ApprovalTemplateMapper approvalTemplateMapper = org.mockito.Mockito.mock(ApprovalTemplateMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final ApprovalTaskApplicationService approvalTaskApplicationService =
      new ApprovalTaskApplicationService(approvalTaskMapper, approvalTemplateMapper, buyerUserMapper);
  private final AuditLogApplicationService auditLogApplicationService = org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final AwardApplicationService awardApplicationService = new AwardApplicationService(
      rfqMapper,
      quoteMapper,
      awardDecisionMapper,
      approvalTaskMapper,
      approvalTaskApplicationService,
      com.procurement.TestApprovalGates.alwaysOn(),
      auditLogApplicationService,
      notificationApplicationService,
      new RfqAwardStatusTransition());

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void awardRejectsRfqThatIsNotOpened() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "报价中"));

    assertThatThrownBy(() -> awardApplicationService.award("rfq-1", new AwardRfqRequest("quote-1", "最低价")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only opened RFQs can be awarded");
  }

  @Test
  void awardFailsWhenRfqStatusChangesBeforeAtomicUpdate() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "已开标"));
    when(quoteMapper.listByTenantAndRfqAndRound("tenant-1", "rfq-1", 1)).thenReturn(java.util.List.of(
        quote("quote-1", "tenant-1", "rfq-1", "supplier-1"),
        quote("quote-2", "tenant-1", "rfq-1", "supplier-2"),
        quote("quote-3", "tenant-1", "rfq-1", "supplier-3")));
    when(quoteMapper.findSubmittedQuoteForAward("tenant-1", "rfq-1", "quote-1", "已提交"))
        .thenReturn(quote("quote-1", "tenant-1", "rfq-1", "supplier-1"));
    when(rfqMapper.updateStatus("tenant-1", "rfq-1", "已开标", "定标审批中"))
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
        .thenReturn(rfq("rfq-1", "tenant-1", "已开标"));
    when(quoteMapper.listByTenantAndRfqAndRound("tenant-1", "rfq-1", 1)).thenReturn(java.util.List.of(
        quote("quote-1", "tenant-1", "rfq-1", "supplier-1"),
        quote("quote-2", "tenant-1", "rfq-1", "supplier-2"),
        quote("quote-3", "tenant-1", "rfq-1", "supplier-3")));
    when(quoteMapper.findSubmittedQuoteForAward("tenant-1", "rfq-1", "quote-1", "已提交"))
        .thenReturn(quote("quote-1", "tenant-1", "rfq-1", "supplier-1"));
    when(rfqMapper.updateStatus("tenant-1", "rfq-1", "已开标", "定标审批中"))
        .thenReturn(1);
    when(quoteMapper.lockSubmittedQuoteForAward("tenant-1", "quote-1", "已提交", "已锁定"))
        .thenReturn(1);
    when(awardDecisionMapper.findByTenantAndId(org.mockito.ArgumentMatchers.eq("tenant-1"), org.mockito.ArgumentMatchers.any()))
        .thenReturn(awardDecision("award-1", "tenant-1", "rfq-1", "quote-1", "supplier-1", "待审批"));
    when(approvalTaskMapper.findByTenantAndId(org.mockito.ArgumentMatchers.eq("tenant-1"), org.mockito.ArgumentMatchers.any()))
        .thenReturn(task("approval-1", "tenant-1", "award-1", "待审批"));
    when(approvalTemplateMapper.findActiveByTenantAndBizType("tenant-1", "rfq_award"))
        .thenReturn(template("TPL_RFQ_AWARD", "rfq_award"));
    when(buyerUserMapper.findDefaultApproverId("tenant-1", "role-buyer-owner"))
        .thenReturn("user-buyer-owner");

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
        org.mockito.ArgumentMatchers.eq("user-buyer-owner"),
        org.mockito.ArgumentMatchers.eq("待审批"));
    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("rfq_award.submitted"),
        org.mockito.ArgumentMatchers.eq("rfq_award"),
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("award-")));
    verify(quoteMapper).lockSubmittedQuoteForAward("tenant-1", "quote-1", "已提交", "已锁定");
    verify(rfqMapper, never()).updateAward("tenant-1", "rfq-1", "定标审批中", "已定标", "supplier-1");
  }

  @Test
  void awardFailsWhenSelectedQuoteCannotBeLocked() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "已开标"));
    when(quoteMapper.listByTenantAndRfqAndRound("tenant-1", "rfq-1", 1)).thenReturn(java.util.List.of(
        quote("quote-1", "tenant-1", "rfq-1", "supplier-1"),
        quote("quote-2", "tenant-1", "rfq-1", "supplier-2"),
        quote("quote-3", "tenant-1", "rfq-1", "supplier-3")));
    when(quoteMapper.findSubmittedQuoteForAward("tenant-1", "rfq-1", "quote-1", "已提交"))
        .thenReturn(quote("quote-1", "tenant-1", "rfq-1", "supplier-1"));
    when(rfqMapper.updateStatus("tenant-1", "rfq-1", "已开标", "定标审批中"))
        .thenReturn(1);
    when(quoteMapper.lockSubmittedQuoteForAward("tenant-1", "quote-1", "已提交", "已锁定"))
        .thenReturn(0);

    assertThatThrownBy(() -> awardApplicationService.award("rfq-1", new AwardRfqRequest("quote-1", "最低价")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Selected quote changed before award approval could be submitted: quote-1");

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

  private ApprovalTemplate template(String code, String bizType) {
    return new ApprovalTemplate(code, "tenant-1", bizType, "审批模板", "role-buyer-owner", "active");
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
    when(approvalTaskMapper.updateStatus("tenant-1", "approval-1", "待审批", "已通过", "approver-1", null))
        .thenReturn(1);
    when(awardDecisionMapper.updateApprovedStatus("tenant-1", "award-1", "待审批", "已通过"))
        .thenReturn(1);
    when(rfqMapper.updateAward("tenant-1", "rfq-1", "定标审批中", "已定标", "supplier-1"))
        .thenReturn(1);
    when(quoteMapper.markAwardedQuote("tenant-1", "quote-1", "已锁定", "已中选"))
        .thenReturn(1);
    when(quoteMapper.closeUnawardedQuotes("tenant-1", "rfq-1", "quote-1", "已提交", "未中选"))
        .thenReturn(2);
    when(awardDecisionMapper.findByTenantAndId("tenant-1", "award-1"))
        .thenReturn(awardDecision("award-1", "tenant-1", "rfq-1", "quote-1", "supplier-1", "待审批"))
        .thenReturn(awardDecision("award-1", "tenant-1", "rfq-1", "quote-1", "supplier-1", "已通过"));

    AwardDecisionResponse response = awardApplicationService.reviewApproval(
        "rfq-1",
        new ReviewAwardApprovalRequest("award-1", true));

    assertThat(response.approvedStatus()).isEqualTo("已通过");
    verify(rfqMapper).updateAward("tenant-1", "rfq-1", "定标审批中", "已定标", "supplier-1");
    verify(quoteMapper).markAwardedQuote("tenant-1", "quote-1", "已锁定", "已中选");
    verify(quoteMapper).closeUnawardedQuotes("tenant-1", "rfq-1", "quote-1", "已提交", "未中选");
    verify(auditLogApplicationService).recordTenantAction("rfq_award.approved", "rfq_award", "award-1");
    verify(notificationApplicationService).notifyActiveTenantUsers(
        "tenant-1",
        "定标审批已通过",
        "办公电脑询价定标审批已通过。");
  }

  @Test
  void awardRejectionUnlocksSelectedQuoteBackToSubmitted() {
    TenantContext.set("tenant-1", null, "approver-1");
    when(awardDecisionMapper.findByTenantAndId("tenant-1", "award-1"))
        .thenReturn(awardDecision("award-1", "tenant-1", "rfq-1", "quote-1", "supplier-1", "待审批"))
        .thenReturn(awardDecision("award-1", "tenant-1", "rfq-1", "quote-1", "supplier-1", "已驳回"));
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "tenant-1", "定标审批中"));
    when(approvalTaskMapper.findPendingByBiz("tenant-1", "rfq_award", "award-1", "待审批"))
        .thenReturn(task("approval-1", "tenant-1", "award-1", "待审批"));
    when(approvalTaskMapper.updateStatus("tenant-1", "approval-1", "待审批", "已驳回", "approver-1", null))
        .thenReturn(1);
    when(awardDecisionMapper.updateApprovedStatus("tenant-1", "award-1", "待审批", "已驳回"))
        .thenReturn(1);
    when(rfqMapper.updateStatus("tenant-1", "rfq-1", "定标审批中", "已开标"))
        .thenReturn(1);
    when(quoteMapper.unlockAwardQuote("tenant-1", "quote-1", "已锁定", "已提交"))
        .thenReturn(1);

    AwardDecisionResponse response = awardApplicationService.reviewApproval(
        "rfq-1",
        new ReviewAwardApprovalRequest("award-1", false));

    assertThat(response.approvedStatus()).isEqualTo("已驳回");
    verify(quoteMapper).unlockAwardQuote("tenant-1", "quote-1", "已锁定", "已提交");
    verify(auditLogApplicationService).recordTenantAction("rfq_award.rejected", "rfq_award", "award-1");
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
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "", "", "最低价", null, 1, false, "询价", null, null, null, null, null);
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
        OffsetDateTime.parse("2026-06-15T11:35:00+08:00"),
        null);
  }
}
