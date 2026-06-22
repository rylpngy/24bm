package com.procurement;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.notification.infrastructure.NotificationMapper;
import com.procurement.sourcing.api.CreateRfqRequest;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqAuditAction;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.domain.SupplierQualification;
import com.procurement.supplier.domain.SupplierUser;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import com.procurement.supplier.infrastructure.SupplierUserMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class RfqCreationCollaborationTests {

  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final QuoteMapper quoteMapper = org.mockito.Mockito.mock(QuoteMapper.class);
  private final RfqDemandMapper rfqDemandMapper = org.mockito.Mockito.mock(RfqDemandMapper.class);
  private final RfqInviteMapper rfqInviteMapper = org.mockito.Mockito.mock(RfqInviteMapper.class);
  private final PurchaseDemandMapper purchaseDemandMapper = org.mockito.Mockito.mock(PurchaseDemandMapper.class);
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper = org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
  private final SupplierQualificationMapper supplierQualificationMapper = org.mockito.Mockito.mock(SupplierQualificationMapper.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationMapper notificationMapper = org.mockito.Mockito.mock(NotificationMapper.class);
  private final SupplierUserMapper supplierUserMapper = org.mockito.Mockito.mock(SupplierUserMapper.class);
  private final NotificationApplicationService notificationApplicationService =
      new NotificationApplicationService(notificationMapper, null, supplierUserMapper);
  private final RfqApplicationService rfqApplicationService = new RfqApplicationService(
      rfqMapper,
      quoteMapper,
      rfqDemandMapper,
      rfqInviteMapper,
      purchaseDemandMapper,
      buyerSupplierRelationMapper,
      supplierQualificationMapper,
      tenantFeatureApplicationService,
      new RfqSourcingStatusTransition(),
      auditLogApplicationService,
      notificationApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void creatingRfqRecordsAuditAndNotifiesActiveInvitedSupplierUsers() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "demand-1"))
        .thenReturn(demand("demand-1", "tenant-1", "已通过"));
    when(rfqDemandMapper.countByTenantAndDemand("tenant-1", "demand-1")).thenReturn(0);
    when(buyerSupplierRelationMapper.countByTenantSupplierAndStatus("tenant-1", "supplier-1", "已准入"))
        .thenReturn(1);
    when(supplierQualificationMapper.listActiveBySupplier("supplier-1"))
        .thenReturn(List.of(qualification("qual-1", "supplier-1")));
    when(rfqMapper.findByTenantAndId(eq("tenant-1"), anyString()))
        .thenAnswer(invocation -> rfq(invocation.getArgument(1), "办公电脑询价"));
    when(rfqDemandMapper.listDemandIds(eq("tenant-1"), anyString())).thenReturn(List.of("demand-1"));
    when(rfqInviteMapper.listSupplierIds(eq("tenant-1"), anyString())).thenReturn(List.of("supplier-1"));
    when(quoteMapper.listByTenantAndRfq(eq("tenant-1"), anyString())).thenReturn(List.of());
    when(supplierUserMapper.listBySupplier("supplier-1")).thenReturn(List.of(
        supplierUser("supplier-user-active", "启用"),
        supplierUser("supplier-user-disabled", "停用")));

    var response = rfqApplicationService.create(new CreateRfqRequest(
        "办公电脑询价",
        List.of("demand-1"),
        List.of("supplier-1"),
        OffsetDateTime.now().plusDays(7)));

    verify(auditLogApplicationService).recordTenantAction(
        RfqAuditAction.CREATED,
        AuditTargetType.RFQ,
        response.id());
    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        eq("tenant-1"),
        eq("supplier-user-active"),
        eq(NotificationTitle.RFQ_INVITATION_CREATED),
        eq("办公电脑询价已邀请您参与报价，请及时处理。"));
    verify(notificationMapper, never()).insert(
        anyString(),
        eq("tenant-1"),
        eq("supplier-user-disabled"),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void creatingRfqRejectsInvitedSupplierWithoutActiveQualification() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "demand-1"))
        .thenReturn(demand("demand-1", "tenant-1", "已通过"));
    when(rfqDemandMapper.countByTenantAndDemand("tenant-1", "demand-1")).thenReturn(0);
    when(buyerSupplierRelationMapper.countByTenantSupplierAndStatus("tenant-1", "supplier-1", "已准入"))
        .thenReturn(1);
    when(supplierQualificationMapper.listActiveBySupplier("supplier-1"))
        .thenReturn(List.of());

    org.assertj.core.api.Assertions.assertThatThrownBy(() -> rfqApplicationService.create(new CreateRfqRequest(
            "办公电脑询价",
            List.of("demand-1"),
            List.of("supplier-1"),
            OffsetDateTime.now().plusDays(7))))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Supplier lacks active qualification for tenant RFQ: supplier-1");
  }

  private PurchaseDemand demand(String id, String tenantId, String status) {
    return new PurchaseDemand(
        id,
        tenantId,
        "采购需求",
        "dept-1",
        "buyer-user",
        BigDecimal.valueOf(1000),
        status,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }

  private Rfq rfq(String id, String title) {
    return new Rfq(
        id,
        "tenant-1",
        title,
        "报价中",
        OffsetDateTime.parse("2026-07-01T18:00:00+08:00"),
        "buyer-user",
        null,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }

  private SupplierUser supplierUser(String id, String status) {
    return new SupplierUser(
        id,
        "supplier-1",
        "供应商用户",
        "13900000001",
        id + "@example.com",
        status,
        "role-supplier-sales");
  }

  private SupplierQualification qualification(String id, String supplierId) {
    return new SupplierQualification(
        id,
        supplierId,
        "营业执照",
        "Q-2026-001",
        LocalDate.parse("2027-12-31"),
        "营业执照.pdf",
        "supplier/qualifications/business-license.pdf",
        "active",
        OffsetDateTime.parse("2026-06-22T10:00:00+08:00"));
  }
}
