package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.api.CreatePurchaseDemandRequest;
import com.procurement.demand.api.PurchaseDemandLineItemRequest;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.demand.domain.PurchaseDemand;
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

class PurchaseDemandDepartmentValidationTests {

  private final PurchaseDemandMapper purchaseDemandMapper = org.mockito.Mockito.mock(PurchaseDemandMapper.class);
  private final PurchaseDemandItemMapper purchaseDemandItemMapper = org.mockito.Mockito.mock(PurchaseDemandItemMapper.class);
  private final ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final DepartmentMapper departmentMapper = org.mockito.Mockito.mock(DepartmentMapper.class);
  private final ApprovalTaskApplicationService approvalTaskApplicationService =
      new ApprovalTaskApplicationService(approvalTaskMapper, buyerUserMapper);
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
          departmentMapper,
          auditLogApplicationService,
          notificationApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void createDemandRejectsDepartmentOutsideCurrentTenantBeforeInsert() {
    TenantContext.set("tenant-1", null, "buyer-user-1");
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-other")).thenReturn(false);

    assertThatThrownBy(() -> purchaseDemandApplicationService.create(new CreatePurchaseDemandRequest(
        "办公电脑采购",
        "dept-other",
        BigDecimal.valueOf(120000),
        List.of(new PurchaseDemandLineItemRequest("mat-laptop", BigDecimal.TEN)))))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Department not found in tenant scope: dept-other");

    verify(purchaseDemandMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void createDemandChecksDepartmentInCurrentTenantBeforeInsert() {
    TenantContext.set("tenant-1", null, "buyer-user-1");
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-it")).thenReturn(true);
    when(purchaseDemandMapper.findByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> demand(invocation.getArgument(1)));
    when(purchaseDemandItemMapper.listByDemand(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.anyString()))
        .thenReturn(List.of());

    var response = purchaseDemandApplicationService.create(new CreatePurchaseDemandRequest(
        "办公电脑采购",
        "dept-it",
        BigDecimal.valueOf(120000),
        List.of(new PurchaseDemandLineItemRequest("mat-laptop", BigDecimal.TEN))));

    assertThat(response.departmentId()).isEqualTo("dept-it");
    verify(departmentMapper).existsActiveByTenantAndId("tenant-1", "dept-it");
    verify(purchaseDemandMapper).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("办公电脑采购"),
        org.mockito.ArgumentMatchers.eq("dept-it"),
        org.mockito.ArgumentMatchers.eq("buyer-user-1"),
        org.mockito.ArgumentMatchers.eq(BigDecimal.valueOf(120000)),
        org.mockito.ArgumentMatchers.eq("草稿"));
  }

  private PurchaseDemand demand(String id) {
    return new PurchaseDemand(
        id,
        "tenant-1",
        "办公电脑采购",
        "dept-it",
        "buyer-user-1",
        BigDecimal.valueOf(120000),
        "草稿",
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }
}
