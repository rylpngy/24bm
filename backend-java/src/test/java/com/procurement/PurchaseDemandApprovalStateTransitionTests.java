package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.api.ApprovalTaskResponse;
import com.procurement.demand.api.ReviewPurchaseDemandRequest;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.infrastructure.PurchaseDemandItemMapper;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.organization.infrastructure.DepartmentMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PurchaseDemandApprovalStateTransitionTests {

  private final PurchaseDemandMapper purchaseDemandMapper = org.mockito.Mockito.mock(PurchaseDemandMapper.class);
  private final PurchaseDemandItemMapper purchaseDemandItemMapper = org.mockito.Mockito.mock(PurchaseDemandItemMapper.class);
  private final ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
  private final ApprovalTemplateMapper approvalTemplateMapper = org.mockito.Mockito.mock(ApprovalTemplateMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final DepartmentMapper departmentMapper = org.mockito.Mockito.mock(DepartmentMapper.class);
  private final ApprovalTaskApplicationService approvalTaskApplicationService =
      new ApprovalTaskApplicationService(approvalTaskMapper, approvalTemplateMapper, buyerUserMapper);
  private final AuditLogApplicationService auditLogApplicationService = org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
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
  void approvalApprovesInApprovalDemandAndCompletesPendingTask() {
    TenantContext.set("tenant-1", null, "approver-1");
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "demand-1"))
        .thenReturn(demand("demand-1", "tenant-1", "审批中"));
    when(approvalTaskMapper.findPendingByBiz("tenant-1", "purchase_demand", "demand-1", "待审批"))
        .thenReturn(task("approval-1", "tenant-1", "demand-1", "待审批"));
    when(approvalTaskMapper.updateStatus("tenant-1", "approval-1", "待审批", "已通过", "approver-1"))
        .thenReturn(1);
    when(approvalTaskMapper.findByTenantAndId("tenant-1", "approval-1"))
        .thenReturn(task("approval-1", "tenant-1", "demand-1", "已通过"));

    ApprovalTaskResponse response = purchaseDemandApplicationService.review(
        "demand-1",
        new ReviewPurchaseDemandRequest(true));

    assertThat(response.status()).isEqualTo("已通过");
    verify(purchaseDemandMapper).updateStatus("tenant-1", "demand-1", "已通过");
    verify(auditLogApplicationService).recordTenantAction("purchase_demand.approved", "purchase_demand", "demand-1");
    verify(notificationApplicationService).notifyActiveTenantUsers(
        "tenant-1",
        "采购需求审批已通过",
        "采购需求已审批通过。");
  }

  @Test
  void approvalRejectsDemandThatIsNotInApproval() {
    TenantContext.set("tenant-1", null, "approver-1");
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "demand-1"))
        .thenReturn(demand("demand-1", "tenant-1", "草稿"));

    assertThatThrownBy(() -> purchaseDemandApplicationService.review(
        "demand-1",
        new ReviewPurchaseDemandRequest(true)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only in-approval purchase demands can be reviewed");
  }

  private PurchaseDemand demand(String id, String tenantId, String status) {
    return new PurchaseDemand(
        id,
        tenantId,
        "采购需求",
        "dept-1",
        "requester-1",
        BigDecimal.valueOf(1000),
        status,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }

  private ApprovalTask task(String id, String tenantId, String demandId, String status) {
    return new ApprovalTask(
        id,
        tenantId,
        "purchase_demand",
        demandId,
        "approver-1",
        status,
        OffsetDateTime.parse("2026-06-15T10:30:00+08:00"),
        null);
  }
}
