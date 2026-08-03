package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.api.CreateRfqRequest;
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
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 询比草稿生命周期:建项(草稿)→ 选商 → 发布,发布时才校验家数并下发询价函。
class RfqDraftLifecycleTests {

  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final QuoteMapper quoteMapper = org.mockito.Mockito.mock(QuoteMapper.class);
  private final QuoteLineItemMapper quoteLineItemMapper = org.mockito.Mockito.mock(QuoteLineItemMapper.class);
  private final RfqDemandMapper rfqDemandMapper = org.mockito.Mockito.mock(RfqDemandMapper.class);
  private final RfqInviteMapper rfqInviteMapper = org.mockito.Mockito.mock(RfqInviteMapper.class);
  private final PurchaseDemandMapper purchaseDemandMapper = org.mockito.Mockito.mock(PurchaseDemandMapper.class);
  private final DataScopeService dataScopeService = org.mockito.Mockito.mock(DataScopeService.class);
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper =
      org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
  private final SupplierQualificationMapper supplierQualificationMapper =
      org.mockito.Mockito.mock(SupplierQualificationMapper.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final com.procurement.tenant.application.TenantCapabilityApplicationService tenantCapabilityApplicationService =
      org.mockito.Mockito.mock(com.procurement.tenant.application.TenantCapabilityApplicationService.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final RfqApplicationService rfqApplicationService = new RfqApplicationService(
      rfqMapper,
      quoteMapper,
      quoteLineItemMapper,
      rfqDemandMapper,
      rfqInviteMapper,
      purchaseDemandMapper,
      org.mockito.Mockito.mock(com.procurement.demand.application.DirectDemandRegistrar.class),
      dataScopeService,
      buyerSupplierRelationMapper,
      supplierQualificationMapper,
      tenantFeatureApplicationService,
      tenantCapabilityApplicationService,
      new RfqSourcingStatusTransition(),
      org.mockito.Mockito.mock(com.procurement.sourcing.application.RfqItemQueryService.class),
      auditLogApplicationService,
      notificationApplicationService, null);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  private Rfq rfq(String status) {
    return new Rfq(
        "rfq-1", "tenant-1", "行政车辆维保询价", status,
        OffsetDateTime.now().plusDays(3), "buyer-user", null,
        OffsetDateTime.now(), OffsetDateTime.now(), "", "", "最低价",
        null, 1, false, "询比", null, null, null, null, null, null, null, null, null, null, null, null);
  }

  @Test
  void draftCreationSkipsSupplierFloorAndNotification() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "demand-1"))
        .thenReturn(new com.procurement.demand.domain.PurchaseDemand(
            "demand-1", "tenant-1", "维保需求", "dept-it", "buyer-user",
            java.math.BigDecimal.valueOf(80000), "已通过", null, null,
            null, null, null, null));
    when(rfqDemandMapper.countByTenantAndDemand("tenant-1", "demand-1")).thenReturn(0);
    when(rfqMapper.findByTenantAndId(eq("tenant-1"), anyString())).thenReturn(rfq("草稿"));
    when(rfqInviteMapper.listByRfq(eq("tenant-1"), anyString())).thenReturn(List.of());

    rfqApplicationService.create(new CreateRfqRequest(
        "行政车辆维保询价", List.of("demand-1"), List.of(),
        OffsetDateTime.now().plusDays(3), "", "", "最低价", "询比", null, null, null, true, null, null, null, null, null, null, null, null, null, null));

    // 草稿:不校验 3 家下限、不通知供应商。
    verify(rfqMapper).insert(anyString(), eq("tenant-1"), anyString(), eq("草稿"), any(),
        anyString(), anyString(), anyString(), anyString(), anyString(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    verify(notificationApplicationService, never())
        .notifyActiveSupplierUsers(anyString(), anyString(), anyString(), anyString());
  }

  @Test
  void publishRequiresSupplierFloorThenNotifies() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1")).thenReturn(rfq("草稿"));

    when(rfqInviteMapper.listSupplierIds("tenant-1", "rfq-1"))
        .thenReturn(List.of("supplier-1", "supplier-2", "supplier-3"));
    when(rfqMapper.updateStatus("tenant-1", "rfq-1", "草稿", "报价中")).thenReturn(1);
    when(rfqInviteMapper.listByRfq("tenant-1", "rfq-1")).thenReturn(List.of());

    rfqApplicationService.publish("rfq-1");

    verify(notificationApplicationService, org.mockito.Mockito.times(3))
        .notifyActiveSupplierUsers(eq("tenant-1"), anyString(), anyString(), anyString());
  }

  @Test
  void publishRejectsEmptyInvitationList() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1")).thenReturn(rfq("草稿"));
    when(rfqInviteMapper.listSupplierIds("tenant-1", "rfq-1")).thenReturn(List.of());

    // 空邀请单发布=无人可见的死项目,必须拦截。
    assertThatThrownBy(() -> rfqApplicationService.publish("rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("邀请供应商");
  }

  @Test
  void publishRejectsNonDraft() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1")).thenReturn(rfq("报价中"));
    assertThatThrownBy(() -> rfqApplicationService.publish("rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("仅草稿状态");
  }

  @Test
  void draftInvitationUpdateRejectsPublishedRfq() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1")).thenReturn(rfq("报价中"));
    assertThatThrownBy(() -> rfqApplicationService.updateDraftInvitations("rfq-1", List.of("supplier-1")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("仅草稿状态");
  }

  @Test
  void resultAnnouncementRequiresAwardAndIsIdempotent() {
    TenantContext.set("tenant-1", null, "buyer-user");
    // 未定标 → 拒绝
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1")).thenReturn(rfq("报价中"));
    assertThatThrownBy(() -> rfqApplicationService.announceResult("rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("仅已定标");

    // 已定标:公告一次,通知全体受邀方(中标/未中标口径不同)
    Rfq awarded = new Rfq(
        "rfq-1", "tenant-1", "行政车辆维保询价", "已定标",
        OffsetDateTime.now(), "buyer-user", "supplier-1",
        OffsetDateTime.now(), OffsetDateTime.now(), "", "", "最低价",
        null, 1, false, "询比", null, null, null, null, null, null, null, null, null, null, null, null);
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1")).thenReturn(awarded);
    when(rfqMapper.markResultAnnounced("tenant-1", "rfq-1")).thenReturn(1);
    when(rfqInviteMapper.listSupplierIds("tenant-1", "rfq-1"))
        .thenReturn(List.of("supplier-1", "supplier-2", "supplier-3"));
    when(quoteMapper.listByTenantAndRfqAndRound("tenant-1", "rfq-1", 1)).thenReturn(List.of());
    when(rfqInviteMapper.listByRfq("tenant-1", "rfq-1")).thenReturn(List.of());

    rfqApplicationService.announceResult("rfq-1");
    verify(notificationApplicationService, org.mockito.Mockito.times(3))
        .notifyActiveSupplierUsers(eq("tenant-1"), anyString(), anyString(), anyString());

    // 重复公告 → 拒绝(幂等守卫)
    when(rfqMapper.markResultAnnounced("tenant-1", "rfq-1")).thenReturn(0);
    assertThatThrownBy(() -> rfqApplicationService.announceResult("rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("不能重复发布");
  }
}
