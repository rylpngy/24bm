package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.api.PurchaseDemandLineItemRequest;
import com.procurement.demand.api.UpdatePurchaseDemandRequest;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.domain.PurchaseDemandApprovalStatusTransition;
import com.procurement.demand.infrastructure.PurchaseDemandItemMapper;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.organization.infrastructure.DepartmentMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PurchaseDemandUpdateDraftTests {
  private final PurchaseDemandMapper purchaseDemandMapper = org.mockito.Mockito.mock(PurchaseDemandMapper.class);
  private final PurchaseDemandItemMapper purchaseDemandItemMapper = org.mockito.Mockito.mock(PurchaseDemandItemMapper.class);
  private final ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
  private final ApprovalTemplateMapper approvalTemplateMapper = org.mockito.Mockito.mock(ApprovalTemplateMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final DepartmentMapper departmentMapper = org.mockito.Mockito.mock(DepartmentMapper.class);
  private final ApprovalTaskApplicationService approvalTaskApplicationService =
      new ApprovalTaskApplicationService(approvalTaskMapper, approvalTemplateMapper, buyerUserMapper);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final PurchaseDemandApplicationService purchaseDemandApplicationService =
      new PurchaseDemandApplicationService(
          purchaseDemandMapper,
          purchaseDemandItemMapper,
          approvalTaskMapper,
          approvalTaskApplicationService,
          org.mockito.Mockito.mock(com.procurement.sourcing.application.RfqDemandLinkQueryService.class),
          departmentMapper,
          auditLogApplicationService,
          notificationApplicationService,
          new PurchaseDemandApprovalStatusTransition(),
          org.mockito.Mockito.mock(com.procurement.identity.application.DataScopeService.class));

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void updatesDraftDemandProfileAndReplacesLineItemsInsideTenant() {
    TenantContext.set("tenant-1", null, "buyer-user-1");
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "demand-1"))
        .thenReturn(demand("demand-1", "草稿"))
        .thenReturn(updatedDemand("demand-1"));
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-admin")).thenReturn(true);
    when(purchaseDemandMapper.updateDraft(
        "tenant-1",
        "demand-1",
        "更新后的采购需求",
        "dept-admin",
        BigDecimal.valueOf(88000), java.time.LocalDate.parse("2026-07-15"), "常规", "采购用途说明"))
        .thenReturn(1);
    when(purchaseDemandItemMapper.listByDemand("tenant-1", "demand-1"))
        .thenReturn(List.of(new com.procurement.demand.domain.PurchaseDemandItem(
            "item-1", "tenant-1", "demand-1", "mat-laptop", BigDecimal.valueOf(4))));

    var response = purchaseDemandApplicationService.update("demand-1", new UpdatePurchaseDemandRequest(
        "更新后的采购需求",
        "dept-admin",
        BigDecimal.valueOf(88000),
        List.of(new PurchaseDemandLineItemRequest("mat-laptop", BigDecimal.valueOf(4))), java.time.LocalDate.parse("2026-07-15"), "常规", "采购用途说明"));

    assertThat(response.title()).isEqualTo("更新后的采购需求");
    assertThat(response.departmentId()).isEqualTo("dept-admin");
    assertThat(response.budget()).isEqualTo(BigDecimal.valueOf(88000));
    verify(purchaseDemandMapper).updateDraft(
        "tenant-1",
        "demand-1",
        "更新后的采购需求",
        "dept-admin",
        BigDecimal.valueOf(88000), java.time.LocalDate.parse("2026-07-15"), "常规", "采购用途说明");
    verify(purchaseDemandItemMapper).deleteByDemand("tenant-1", "demand-1");
    verify(purchaseDemandItemMapper).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("demand-1"),
        org.mockito.ArgumentMatchers.eq("mat-laptop"),
        org.mockito.ArgumentMatchers.eq(BigDecimal.valueOf(4)));
  }

  @Test
  void rejectsUpdatingDemandAfterSubmission() {
    TenantContext.set("tenant-1", null, "buyer-user-1");
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "demand-1"))
        .thenReturn(demand("demand-1", "审批中"));

    assertThatThrownBy(() -> purchaseDemandApplicationService.update("demand-1", new UpdatePurchaseDemandRequest(
        "审批中需求",
        "dept-it",
        BigDecimal.valueOf(88000),
        List.of(new PurchaseDemandLineItemRequest("mat-laptop", BigDecimal.ONE)), java.time.LocalDate.parse("2026-07-15"), "常规", "采购用途说明")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only draft purchase demand can be updated");

    verify(purchaseDemandMapper, never()).updateDraft(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
  }

  private PurchaseDemand demand(String id, String status) {
    return new PurchaseDemand(
        id,
        "tenant-1",
        "办公电脑采购",
        "dept-it",
        "buyer-user-1",
        BigDecimal.valueOf(120000),
        status,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), java.time.LocalDate.parse("2026-07-15"), "常规", "采购用途说明", null);
  }

  private PurchaseDemand updatedDemand(String id) {
    return new PurchaseDemand(
        id,
        "tenant-1",
        "更新后的采购需求",
        "dept-admin",
        "buyer-user-1",
        BigDecimal.valueOf(88000),
        "草稿",
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T11:00:00+08:00"), java.time.LocalDate.parse("2026-07-15"), "常规", "采购用途说明", null);
  }
}
