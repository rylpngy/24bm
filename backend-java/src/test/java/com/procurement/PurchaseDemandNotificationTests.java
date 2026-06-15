package com.procurement;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.infrastructure.AuditLogMapper;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.infrastructure.PurchaseDemandItemMapper;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.infrastructure.NotificationMapper;
import com.procurement.organization.infrastructure.DepartmentMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PurchaseDemandNotificationTests {

  private final PurchaseDemandMapper purchaseDemandMapper = org.mockito.Mockito.mock(PurchaseDemandMapper.class);
  private final PurchaseDemandItemMapper purchaseDemandItemMapper = org.mockito.Mockito.mock(PurchaseDemandItemMapper.class);
  private final ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final DepartmentMapper departmentMapper = org.mockito.Mockito.mock(DepartmentMapper.class);
  private final ApprovalTaskApplicationService approvalTaskApplicationService =
      new ApprovalTaskApplicationService(approvalTaskMapper, buyerUserMapper);
  private final AuditLogMapper auditLogMapper = org.mockito.Mockito.mock(AuditLogMapper.class);
  private final NotificationMapper notificationMapper = org.mockito.Mockito.mock(NotificationMapper.class);
  private final AuditLogApplicationService auditLogApplicationService = new AuditLogApplicationService(auditLogMapper);
  private final NotificationApplicationService notificationApplicationService =
      new NotificationApplicationService(notificationMapper, buyerUserMapper);
  private final PurchaseDemandApplicationService purchaseDemandApplicationService = new PurchaseDemandApplicationService(
      purchaseDemandMapper,
      purchaseDemandItemMapper,
      approvalTaskMapper,
      approvalTaskApplicationService,
      departmentMapper,
      auditLogApplicationService,
      notificationApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void submittingPurchaseDemandCreatesInAppNotificationsForActiveTenantUsers() {
    TenantContext.set("tenant-1", null, "requester-1");
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "demand-1"))
        .thenReturn(demand("demand-1", "办公电脑采购", "草稿"));
    when(approvalTaskMapper.findByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> approvalTask(invocation.getArgument(1)));
    when(buyerUserMapper.findDefaultApproverId("tenant-1", "role-buyer-owner"))
        .thenReturn("user-buyer-owner");
    when(buyerUserMapper.listByTenant("tenant-1")).thenReturn(List.of(
        new BuyerUser("approver-1", "tenant-1", "审批人", "13800000001", "approver@example.com", "启用", "dept-it"),
        new BuyerUser("disabled-1", "tenant-1", "停用用户", "13800000002", "disabled@example.com", "停用", "dept-it")));

    purchaseDemandApplicationService.submit("demand-1");

    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("approver-1"),
        org.mockito.ArgumentMatchers.eq("采购需求待审批"),
        org.mockito.ArgumentMatchers.eq("办公电脑采购已提交审批，请及时处理。"));
    verify(notificationMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("disabled-1"),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  private PurchaseDemand demand(String id, String title, String status) {
    return new PurchaseDemand(
        id,
        "tenant-1",
        title,
        "dept-it",
        "requester-1",
        BigDecimal.valueOf(120000),
        status,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }

  private ApprovalTask approvalTask(String id) {
    return new ApprovalTask(
        id,
        "tenant-1",
        "purchase_demand",
        "demand-1",
        null,
        "待审批",
        OffsetDateTime.parse("2026-06-15T11:00:00+08:00"));
  }
}
