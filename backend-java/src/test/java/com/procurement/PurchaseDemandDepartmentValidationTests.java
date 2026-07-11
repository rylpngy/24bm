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
import com.procurement.demand.api.CreatePurchaseDemandRequest;
import com.procurement.demand.api.PurchaseDemandLineItemRequest;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.domain.PurchaseDemandApprovalStatusTransition;
import com.procurement.demand.infrastructure.PurchaseDemandItemMapper;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.organization.infrastructure.DepartmentMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PurchaseDemandDepartmentValidationTests {

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
  private final com.procurement.identity.application.DataScopeService dataScopeService =
      org.mockito.Mockito.mock(com.procurement.identity.application.DataScopeService.class);
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
          dataScopeService);

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
        List.of(new PurchaseDemandLineItemRequest("mat-laptop", BigDecimal.TEN)), java.time.LocalDate.parse("2026-07-15"), "常规", "采购用途说明")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Department not found in tenant scope: dept-other");

    verify(purchaseDemandMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
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
        List.of(new PurchaseDemandLineItemRequest("mat-laptop", BigDecimal.TEN)), java.time.LocalDate.parse("2026-07-15"), "常规", "采购用途说明"));

    assertThat(response.departmentId()).isEqualTo("dept-it");
    verify(departmentMapper).existsActiveByTenantAndId("tenant-1", "dept-it");
    verify(purchaseDemandMapper).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("办公电脑采购"),
        org.mockito.ArgumentMatchers.eq("dept-it"),
        org.mockito.ArgumentMatchers.eq("buyer-user-1"),
        org.mockito.ArgumentMatchers.eq(BigDecimal.valueOf(120000)),
        org.mockito.ArgumentMatchers.eq("草稿"), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
  }

  @Test
  void createDemandUsesDepartmentDateSequenceAsBusinessNumber() {
    TenantContext.set("tenant-1", null, "buyer-user-1");
    String date = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-it")).thenReturn(true);
    when(purchaseDemandMapper.countByTenantAndIdPrefix("tenant-1", "IT" + date)).thenReturn(7);
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "IT" + date + "008"))
        .thenReturn(demand("IT" + date + "008"));
    when(purchaseDemandItemMapper.listByDemand("tenant-1", "IT" + date + "008")).thenReturn(List.of());

    var response = purchaseDemandApplicationService.create(new CreatePurchaseDemandRequest(
        "服务器扩容采购",
        "dept-it",
        BigDecimal.valueOf(240000),
        List.of(new PurchaseDemandLineItemRequest("mat-server", BigDecimal.valueOf(4))),
        java.time.LocalDate.parse("2026-07-30"),
        "高",
        "生产环境扩容"));

    assertThat(response.id()).isEqualTo("IT" + date + "008");
    verify(purchaseDemandMapper).insert(
        org.mockito.ArgumentMatchers.eq("IT" + date + "008"),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("服务器扩容采购"),
        org.mockito.ArgumentMatchers.eq("dept-it"),
        org.mockito.ArgumentMatchers.eq("buyer-user-1"),
        org.mockito.ArgumentMatchers.eq(BigDecimal.valueOf(240000)),
        org.mockito.ArgumentMatchers.eq("草稿"),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
  }

  @Test
  void listDemandsAppliesFiltersInsideCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-user-1");
    when(dataScopeService.currentUserDataScope())
        .thenReturn(com.procurement.identity.domain.DataScope.unrestricted());
    when(purchaseDemandMapper.listByTenantFiltered("tenant-1", "已通过", "dept-it", "电脑", null, null))
        .thenReturn(List.of());

    purchaseDemandApplicationService.listCurrentTenantDemands("已通过", "dept-it", "电脑");

    verify(purchaseDemandMapper).listByTenantFiltered("tenant-1", "已通过", "dept-it", "电脑", null, null);
  }

  @Test
  void listDemandsRestrictsToUserDepartmentWhenScopeIsDepartment() {
    TenantContext.set("tenant-1", null, "buyer-user-1");
    when(dataScopeService.currentUserDataScope())
        .thenReturn(com.procurement.identity.domain.DataScope.departments(List.of("dept-it")));

    // 数据范围限定 dept-it;UI 请求 dept-finance(不在范围内)→ 返回空,不下发查询。
    var blocked = purchaseDemandApplicationService.listCurrentTenantDemands(null, "dept-finance", null);
    assertThat(blocked).isEmpty();

    when(purchaseDemandMapper.listByTenantFiltered(
            "tenant-1", null, null, null, List.of("dept-it"), null))
        .thenReturn(List.of());
    purchaseDemandApplicationService.listCurrentTenantDemands(null, null, null);
    verify(purchaseDemandMapper).listByTenantFiltered(
        "tenant-1", null, null, null, List.of("dept-it"), null);
  }

  @Test
  void listDemandsReturnsEmptyWithoutQueryWhenDepartmentScopeBlocksAll() {
    TenantContext.set("tenant-1", null, "buyer-user-1");
    when(dataScopeService.currentUserDataScope())
        .thenReturn(com.procurement.identity.domain.DataScope.departments(List.of()));

    var demands = purchaseDemandApplicationService.listCurrentTenantDemands(null, null, null);

    assertThat(demands).isEmpty();
    verify(purchaseDemandMapper, never()).listByTenantFiltered(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any());
  }

  @Test
  void listDemandsRestrictsToSelfWhenScopeIsSelf() {
    TenantContext.set("tenant-1", null, "buyer-user-1");
    when(dataScopeService.currentUserDataScope())
        .thenReturn(com.procurement.identity.domain.DataScope.self("buyer-user-1"));
    when(purchaseDemandMapper.listByTenantFiltered(
            "tenant-1", null, null, null, null, "buyer-user-1"))
        .thenReturn(List.of());

    purchaseDemandApplicationService.listCurrentTenantDemands(null, null, null);

    verify(purchaseDemandMapper).listByTenantFiltered(
        "tenant-1", null, null, null, null, "buyer-user-1");
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
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), java.time.LocalDate.parse("2026-07-15"), "常规", "采购用途说明", null);
  }
}
