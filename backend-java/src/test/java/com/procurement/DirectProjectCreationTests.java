package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.application.DirectDemandRegistrar;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.infrastructure.PurchaseDemandItemMapper;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.sourcing.api.CreateRfqRequest;
import com.procurement.sourcing.api.DirectRfqItemRequest;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.infrastructure.QuoteLineItemMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 直接立项闭环:计划/询价节点直录采购内容时,系统反向登记「直录登记」需求并自动挂链。
class DirectProjectCreationTests {

  private final RfqMapper rfqMapper = mock(RfqMapper.class);
  private final RfqDemandMapper rfqDemandMapper = mock(RfqDemandMapper.class);
  private final RfqInviteMapper rfqInviteMapper = mock(RfqInviteMapper.class);
  private final PurchaseDemandMapper purchaseDemandMapper = mock(PurchaseDemandMapper.class);
  private final DirectDemandRegistrar directDemandRegistrar = mock(DirectDemandRegistrar.class);
  private final RfqApplicationService rfqApplicationService = new RfqApplicationService(
      rfqMapper,
      mock(QuoteMapper.class),
      mock(QuoteLineItemMapper.class),
      rfqDemandMapper,
      rfqInviteMapper,
      purchaseDemandMapper,
      directDemandRegistrar,
      mock(DataScopeService.class),
      mock(BuyerSupplierRelationMapper.class),
      mock(SupplierQualificationMapper.class),
      mock(TenantFeatureApplicationService.class),
      new RfqSourcingStatusTransition(),
      mock(AuditLogApplicationService.class),
      mock(NotificationApplicationService.class));

  private final PurchaseDemandItemMapper purchaseDemandItemMapper = mock(PurchaseDemandItemMapper.class);
  private final DepartmentMapper departmentMapper = mock(DepartmentMapper.class);
  private final AuditLogApplicationService auditLogApplicationService = mock(AuditLogApplicationService.class);
  private final DirectDemandRegistrar realRegistrar = new DirectDemandRegistrar(
      purchaseDemandMapper, purchaseDemandItemMapper, departmentMapper, auditLogApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  private CreateRfqRequest directRequest(List<DirectRfqItemRequest> items) {
    return new CreateRfqRequest(
        "机房耗材紧急采购", List.of(), List.of(),
        OffsetDateTime.now().plusDays(3), "", "", "最低价", "询比", null, null, null, true,
        items, "dept-it", BigDecimal.valueOf(30000));
  }

  @Test
  void directCreateRegistersBackingDemandAndLinksIt() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(directDemandRegistrar.registerApproved(eq("直录·机房耗材紧急采购"), eq("dept-it"), any(), any()))
        .thenReturn("IT20260711001");
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "IT20260711001"))
        .thenReturn(new PurchaseDemand(
            "IT20260711001", "tenant-1", "直录·机房耗材紧急采购", "dept-it", "buyer-user",
            BigDecimal.valueOf(30000), "已通过", null, null, null, "常规", "", "直录登记"));
    when(rfqDemandMapper.countByTenantAndDemand("tenant-1", "IT20260711001")).thenReturn(0);
    when(rfqMapper.findByTenantAndId(eq("tenant-1"), anyString())).thenReturn(new Rfq(
        "rfq-1", "tenant-1", "机房耗材紧急采购", "草稿",
        OffsetDateTime.now().plusDays(3), "buyer-user", null,
        OffsetDateTime.now(), OffsetDateTime.now(), "", "", "最低价",
        null, 1, false, "询比", null, null, null, null, null));
    when(rfqInviteMapper.listByRfq(eq("tenant-1"), anyString())).thenReturn(List.of());

    rfqApplicationService.create(directRequest(List.of(new DirectRfqItemRequest("mat-cable", 10))));

    verify(directDemandRegistrar).registerApproved(eq("直录·机房耗材紧急采购"), eq("dept-it"), any(), any());
    verify(rfqDemandMapper).insert(anyString(), eq("tenant-1"), anyString(), eq("IT20260711001"));
  }

  @Test
  void directCreateWithoutItemsIsRejected() {
    TenantContext.set("tenant-1", null, "buyer-user");
    assertThatThrownBy(() -> rfqApplicationService.create(directRequest(List.of())))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("直录模式下录入采购内容明细");
  }

  @Test
  void registrarWritesApprovedDemandWithDirectSource() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-it")).thenReturn(true);
    when(purchaseDemandMapper.countByTenantAndIdPrefix(eq("tenant-1"), anyString())).thenReturn(0);

    String demandId = realRegistrar.registerApproved(
        "直录·机房耗材紧急采购", "dept-it", BigDecimal.valueOf(30000),
        List.of(new DirectDemandRegistrar.DirectLineItem("mat-cable", 10)));

    assertThat(demandId).startsWith("IT");
    verify(purchaseDemandMapper).insert(
        eq(demandId), eq("tenant-1"), eq("直录·机房耗材紧急采购"), eq("dept-it"), eq("buyer-user"),
        eq(BigDecimal.valueOf(30000)), eq("已通过"), any(), eq("常规"), anyString(), eq("直录登记"));
    verify(purchaseDemandItemMapper).insert(
        anyString(), eq("tenant-1"), eq(demandId), eq("mat-cable"), eq(BigDecimal.valueOf(10)));
  }

  @Test
  void registrarRejectsUnknownDepartment() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(departmentMapper.existsActiveByTenantAndId("tenant-1", "dept-x")).thenReturn(false);
    assertThatThrownBy(() -> realRegistrar.registerApproved(
        "直录·测试", "dept-x", BigDecimal.ONE,
        List.of(new DirectDemandRegistrar.DirectLineItem("mat-1", 1))))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("归口部门");
  }
}
