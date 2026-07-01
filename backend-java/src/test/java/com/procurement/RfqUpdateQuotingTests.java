package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.api.UpdateRfqRequest;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.infrastructure.QuoteLineItemMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.domain.SupplierQualification;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class RfqUpdateQuotingTests {
  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final QuoteMapper quoteMapper = org.mockito.Mockito.mock(QuoteMapper.class);
  private final QuoteLineItemMapper quoteLineItemMapper =
      org.mockito.Mockito.mock(QuoteLineItemMapper.class);
  private final RfqDemandMapper rfqDemandMapper = org.mockito.Mockito.mock(RfqDemandMapper.class);
  private final RfqInviteMapper rfqInviteMapper = org.mockito.Mockito.mock(RfqInviteMapper.class);
  private final PurchaseDemandMapper purchaseDemandMapper = org.mockito.Mockito.mock(PurchaseDemandMapper.class);
  private final DataScopeService dataScopeService = org.mockito.Mockito.mock(DataScopeService.class);
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper = org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
  private final SupplierQualificationMapper supplierQualificationMapper = org.mockito.Mockito.mock(SupplierQualificationMapper.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
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
      dataScopeService,
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
  void updatesQuotingRfqProfileAndReplacesInvitedSuppliersInsideTenant() {
    TenantContext.set("tenant-1", null, "buyer-user");
    var deadline = OffsetDateTime.parse("2026-07-05T18:00:00+08:00");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "报价中", OffsetDateTime.parse("2026-07-01T18:00:00+08:00")))
        .thenReturn(rfq("rfq-1", "报价中", deadline));
    when(rfqMapper.updateQuotingDetails("tenant-1", "rfq-1", "更新后的询价", deadline, "", "", "最低价"))
        .thenReturn(1);
    when(buyerSupplierRelationMapper.countByTenantSupplierAndStatus("tenant-1", "supplier-1", "已准入"))
        .thenReturn(1);
    when(buyerSupplierRelationMapper.countByTenantSupplierAndStatus("tenant-1", "supplier-2", "已准入"))
        .thenReturn(1);
    when(supplierQualificationMapper.listActiveBySupplier("supplier-1"))
        .thenReturn(List.of(qualification("qual-1", "supplier-1")));
    when(supplierQualificationMapper.listActiveBySupplier("supplier-2"))
        .thenReturn(List.of(qualification("qual-2", "supplier-2")));
    when(rfqDemandMapper.listDemandIds("tenant-1", "rfq-1")).thenReturn(List.of("demand-1"));
    when(rfqInviteMapper.listSupplierIds("tenant-1", "rfq-1")).thenReturn(List.of("supplier-1", "supplier-2"));
    when(quoteMapper.listByTenantAndRfq("tenant-1", "rfq-1")).thenReturn(List.of());

    var response = rfqApplicationService.update("rfq-1", new UpdateRfqRequest(
        "更新后的询价",
        List.of("supplier-1", "supplier-2"),
        deadline, "", "", "最低价"));

    assertThat(response.title()).isEqualTo("更新后的询价");
    assertThat(response.deadlineAt()).isEqualTo(deadline);
    assertThat(response.invitedSupplierIds()).containsExactly("supplier-1", "supplier-2");
    verify(rfqMapper).updateQuotingDetails("tenant-1", "rfq-1", "更新后的询价", deadline, "", "", "最低价");
    verify(rfqInviteMapper).deleteByRfq("tenant-1", "rfq-1");
    verify(rfqInviteMapper).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("rfq-1"),
        org.mockito.ArgumentMatchers.eq("supplier-1"),
        org.mockito.ArgumentMatchers.eq("已邀请"));
    verify(rfqInviteMapper).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("rfq-1"),
        org.mockito.ArgumentMatchers.eq("supplier-2"),
        org.mockito.ArgumentMatchers.eq("已邀请"));
  }

  @Test
  void updatingQuotingRfqAuditsAndNotifiesInvitedSuppliers() {
    TenantContext.set("tenant-1", null, "buyer-user");
    var deadline = OffsetDateTime.parse("2026-07-05T18:00:00+08:00");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "报价中", OffsetDateTime.parse("2026-07-01T18:00:00+08:00")))
        .thenReturn(rfq("rfq-1", "报价中", deadline));
    when(rfqMapper.updateQuotingDetails("tenant-1", "rfq-1", "更新后的询价", deadline, "", "", "最低价"))
        .thenReturn(1);
    when(buyerSupplierRelationMapper.countByTenantSupplierAndStatus("tenant-1", "supplier-1", "已准入"))
        .thenReturn(1);
    when(buyerSupplierRelationMapper.countByTenantSupplierAndStatus("tenant-1", "supplier-2", "已准入"))
        .thenReturn(1);
    when(supplierQualificationMapper.listActiveBySupplier("supplier-1"))
        .thenReturn(List.of(qualification("qual-1", "supplier-1")));
    when(supplierQualificationMapper.listActiveBySupplier("supplier-2"))
        .thenReturn(List.of(qualification("qual-2", "supplier-2")));
    when(rfqDemandMapper.listDemandIds("tenant-1", "rfq-1")).thenReturn(List.of("demand-1"));
    when(rfqInviteMapper.listSupplierIds("tenant-1", "rfq-1")).thenReturn(List.of("supplier-1", "supplier-2"));
    when(quoteMapper.listByTenantAndRfq("tenant-1", "rfq-1")).thenReturn(List.of());

    rfqApplicationService.update("rfq-1", new UpdateRfqRequest(
        "更新后的询价",
        List.of("supplier-1", "supplier-2"),
        deadline, "", "", "最低价"));

    verify(auditLogApplicationService)
        .recordTenantAction("rfq.updated", AuditTargetType.RFQ, "rfq-1");
    verify(notificationApplicationService).notifyActiveSupplierUsers(
        "tenant-1",
        "supplier-1",
        "询价邀请已更新",
        "更新后的询价已更新询价信息，请按最新要求报价。");
    verify(notificationApplicationService).notifyActiveSupplierUsers(
        "tenant-1",
        "supplier-2",
        "询价邀请已更新",
        "更新后的询价已更新询价信息，请按最新要求报价。");
  }

  @Test
  void rejectsUpdatingRfqAfterAwardApprovalStarts() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "定标审批中", OffsetDateTime.parse("2026-07-01T18:00:00+08:00")));

    assertThatThrownBy(() -> rfqApplicationService.update("rfq-1", new UpdateRfqRequest(
        "审批中的询价",
        List.of("supplier-1"),
        OffsetDateTime.parse("2026-07-05T18:00:00+08:00"), "", "", "最低价")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only quoting RFQ can be updated");

    verify(rfqMapper, never()).updateQuotingDetails(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void rejectsDuplicatedInvitedSuppliersBeforeReplacingExistingInvites() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "报价中", OffsetDateTime.parse("2026-07-01T18:00:00+08:00")));

    assertThatThrownBy(() -> rfqApplicationService.update("rfq-1", new UpdateRfqRequest(
        "重复邀请询价",
        List.of("supplier-1", "supplier-1"),
        OffsetDateTime.parse("2026-07-05T18:00:00+08:00"), "", "", "最低价")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("RFQ cannot invite the same supplier more than once: supplier-1");

    verify(rfqInviteMapper, never()).deleteByRfq("tenant-1", "rfq-1");
    verify(rfqMapper, never()).updateQuotingDetails(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void rejectsUpdatingRfqWithSupplierWithoutActiveQualificationBeforeReplacingExistingInvites() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "报价中", OffsetDateTime.parse("2026-07-01T18:00:00+08:00")));
    when(buyerSupplierRelationMapper.countByTenantSupplierAndStatus("tenant-1", "supplier-1", "已准入"))
        .thenReturn(1);
    when(supplierQualificationMapper.listActiveBySupplier("supplier-1"))
        .thenReturn(List.of());

    assertThatThrownBy(() -> rfqApplicationService.update("rfq-1", new UpdateRfqRequest(
        "更新后的询价",
        List.of("supplier-1"),
        OffsetDateTime.parse("2026-07-05T18:00:00+08:00"), "", "", "最低价")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Supplier lacks active qualification for tenant RFQ: supplier-1");

    verify(rfqInviteMapper, never()).deleteByRfq("tenant-1", "rfq-1");
  }

  @Test
  void startsNewRoundFromOpenedRfqBumpingRoundAndReSealing() {
    TenantContext.set("tenant-1", null, "buyer-user");
    var newDeadline = OffsetDateTime.parse("2026-07-12T18:00:00+08:00");
    Rfq opened = new Rfq("rfq-1", "tenant-1", "办公电脑询价", "已开标",
        OffsetDateTime.parse("2026-06-20T18:00:00+08:00"), "buyer-user", null,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-21T09:00:00+08:00"), "", "", "最低价",
        OffsetDateTime.parse("2026-06-21T09:00:00+08:00"), 1, false, "询价", null);
    Rfq round2 = new Rfq("rfq-1", "tenant-1", "办公电脑询价", "报价中", newDeadline, "buyer-user", null,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), newDeadline, "", "", "最低价", null, 2, true, "询价", null);
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1")).thenReturn(opened).thenReturn(round2);
    when(rfqMapper.startNewRound("tenant-1", "rfq-1", newDeadline, true)).thenReturn(1);

    var response = rfqApplicationService.startNewRound("rfq-1", newDeadline, true, "谈判说明");

    assertThat(response.status()).isEqualTo("报价中");
    assertThat(response.currentRound()).isEqualTo(2);
    assertThat(response.finalRound()).isTrue();
    verify(rfqMapper).startNewRound("tenant-1", "rfq-1", newDeadline, true);
  }

  @Test
  void rejectsNewRoundWhenRfqNotOpened() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "报价中", OffsetDateTime.parse("2026-07-01T18:00:00+08:00")));

    assertThatThrownBy(() -> rfqApplicationService.startNewRound(
        "rfq-1", OffsetDateTime.parse("2026-07-12T18:00:00+08:00"), false, null))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only opened RFQs can start a new round");
    verify(rfqMapper, never()).startNewRound(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyBoolean());
  }

  private Rfq rfq(String id, String status, OffsetDateTime deadline) {
    return new Rfq(
        id,
        "tenant-1",
        status.equals("报价中") ? "更新后的询价" : "审批中的询价",
        status,
        deadline,
        "buyer-user",
        null,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T11:00:00+08:00"), "", "", "最低价", null, 1, false, "询价", null);
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
