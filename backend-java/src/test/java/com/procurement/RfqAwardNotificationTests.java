package com.procurement;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.approval.domain.ApprovalTemplate;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.infrastructure.NotificationMapper;
import com.procurement.sourcing.api.AwardRfqRequest;
import com.procurement.sourcing.api.ReviewAwardApprovalRequest;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqAwardStatusTransition;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.sourcing.application.AwardApplicationService;
import com.procurement.supplier.domain.SupplierUser;
import com.procurement.supplier.infrastructure.SupplierUserMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class RfqAwardNotificationTests {

  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final QuoteMapper quoteMapper = org.mockito.Mockito.mock(QuoteMapper.class);
  private final AwardDecisionMapper awardDecisionMapper = org.mockito.Mockito.mock(AwardDecisionMapper.class);
  private final ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
  private final ApprovalTemplateMapper approvalTemplateMapper = org.mockito.Mockito.mock(ApprovalTemplateMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final SupplierUserMapper supplierUserMapper = org.mockito.Mockito.mock(SupplierUserMapper.class);
  private final ApprovalTaskApplicationService approvalTaskApplicationService =
      new ApprovalTaskApplicationService(approvalTaskMapper, approvalTemplateMapper, buyerUserMapper);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationMapper notificationMapper = org.mockito.Mockito.mock(NotificationMapper.class);
  private final NotificationApplicationService notificationApplicationService =
      new NotificationApplicationService(notificationMapper, buyerUserMapper, supplierUserMapper);
  private final AwardApplicationService awardApplicationService = new AwardApplicationService(
      rfqMapper,
      quoteMapper,
      awardDecisionMapper,
      approvalTaskMapper,
      approvalTaskApplicationService,
      auditLogApplicationService,
      notificationApplicationService,
      new RfqAwardStatusTransition());

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void submittingRfqAwardCreatesInAppNotificationsForActiveTenantUsers() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "办公电脑询价", "已开标"));
    when(quoteMapper.findSubmittedQuoteForAward("tenant-1", "rfq-1", "quote-1", "已提交"))
        .thenReturn(quote("quote-1", "tenant-1", "rfq-1", "supplier-1"));
    when(rfqMapper.updateStatus("tenant-1", "rfq-1", "已开标", "定标审批中"))
        .thenReturn(1);
    when(quoteMapper.lockSubmittedQuoteForAward("tenant-1", "quote-1", "已提交", "已锁定"))
        .thenReturn(1);
    when(awardDecisionMapper.findByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> awardDecision(invocation.getArgument(1)));
    when(approvalTemplateMapper.findActiveByTenantAndBizType("tenant-1", "rfq_award"))
        .thenReturn(template("TPL_RFQ_AWARD", "rfq_award"));
    when(buyerUserMapper.findDefaultApproverId("tenant-1", "role-buyer-owner"))
        .thenReturn("user-buyer-owner");
    when(buyerUserMapper.listByTenant("tenant-1")).thenReturn(List.of(
        new BuyerUser("approver-1", "tenant-1", "审批人", "13800000001", "approver@example.com", "启用", "dept-it", "role-buyer-owner"),
        new BuyerUser("disabled-1", "tenant-1", "停用用户", "13800000002", "disabled@example.com", "停用", "dept-it", "role-buyer-requester")));

    awardApplicationService.award("rfq-1", new AwardRfqRequest("quote-1", "最低价"));

    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("approver-1"),
        org.mockito.ArgumentMatchers.eq("定标结果待审批"),
        org.mockito.ArgumentMatchers.eq("办公电脑询价已提交定标审批，请及时处理。"));
    verify(notificationMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("disabled-1"),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void approvedRfqAwardNotifiesAwardedAndUnawardedSupplierUsers() {
    TenantContext.set("tenant-1", null, "approver-1");
    when(awardDecisionMapper.findByTenantAndId("tenant-1", "award-1"))
        .thenReturn(awardDecision("award-1"));
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "办公电脑询价", "定标审批中"));
    when(approvalTaskMapper.findPendingByBiz("tenant-1", "rfq_award", "award-1", "待审批"))
        .thenReturn(approvalTask("approval-1", "待审批"));
    when(approvalTaskMapper.updateStatus("tenant-1", "approval-1", "待审批", "已通过", "approver-1", null))
        .thenReturn(1);
    when(awardDecisionMapper.updateApprovedStatus("tenant-1", "award-1", "待审批", "已通过"))
        .thenReturn(1);
    when(rfqMapper.updateAward("tenant-1", "rfq-1", "定标审批中", "已定标", "supplier-1"))
        .thenReturn(1);
    when(quoteMapper.markAwardedQuote("tenant-1", "quote-1", "已锁定", "已中选"))
        .thenReturn(1);
    when(quoteMapper.listByTenantAndRfq("tenant-1", "rfq-1"))
        .thenReturn(List.of(
            quote("quote-1", "tenant-1", "rfq-1", "supplier-1"),
            quote("quote-2", "tenant-1", "rfq-1", "supplier-2")));
    when(supplierUserMapper.listBySupplier("supplier-1")).thenReturn(List.of(
        supplierUser("supplier-user-awarded", "supplier-1", "启用")));
    when(supplierUserMapper.listBySupplier("supplier-2")).thenReturn(List.of(
        supplierUser("supplier-user-unawarded", "supplier-2", "启用")));

    awardApplicationService.reviewApproval(
        "rfq-1",
        new ReviewAwardApprovalRequest("award-1", true));

    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("supplier-user-awarded"),
        org.mockito.ArgumentMatchers.eq("报价已中选"),
        org.mockito.ArgumentMatchers.eq("办公电脑询价定标审批已通过，贵司报价已中选。"));
    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("supplier-user-unawarded"),
        org.mockito.ArgumentMatchers.eq("报价未中选"),
        org.mockito.ArgumentMatchers.eq("办公电脑询价定标审批已通过，贵司报价未中选。"));
  }

  private ApprovalTemplate template(String code, String bizType) {
    return new ApprovalTemplate(code, "tenant-1", bizType, "审批模板", "role-buyer-owner", "active");
  }

  private Rfq rfq(String id, String title, String status) {
    return new Rfq(
        id,
        "tenant-1",
        title,
        status,
        OffsetDateTime.parse("2026-06-20T18:00:00+08:00"),
        "buyer-user",
        null,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "", "", "最低价");
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

  private com.procurement.approval.domain.ApprovalTask approvalTask(String id, String status) {
    return new com.procurement.approval.domain.ApprovalTask(
        id,
        "tenant-1",
        "rfq_award",
        "award-1",
        "approver-1",
        status,
        OffsetDateTime.parse("2026-06-15T11:30:00+08:00"),
        OffsetDateTime.parse("2026-06-15T11:30:00+08:00"));
  }

  private SupplierUser supplierUser(String id, String supplierId, String status) {
    return new SupplierUser(
        id,
        supplierId,
        "供应商用户",
        "13800000001",
        id + "@example.com",
        status,
        "role-supplier-sales");
  }

  private AwardDecision awardDecision(String id) {
    return new AwardDecision(
        id,
        "tenant-1",
        "rfq-1",
        "quote-1",
        "supplier-1",
        BigDecimal.valueOf(100),
        "最低价",
        "待审批",
        OffsetDateTime.parse("2026-06-15T11:30:00+08:00"));
  }
}
