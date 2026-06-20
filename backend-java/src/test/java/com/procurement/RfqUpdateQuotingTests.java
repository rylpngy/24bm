package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.sourcing.api.UpdateRfqRequest;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class RfqUpdateQuotingTests {
  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final QuoteMapper quoteMapper = org.mockito.Mockito.mock(QuoteMapper.class);
  private final RfqDemandMapper rfqDemandMapper = org.mockito.Mockito.mock(RfqDemandMapper.class);
  private final RfqInviteMapper rfqInviteMapper = org.mockito.Mockito.mock(RfqInviteMapper.class);
  private final PurchaseDemandMapper purchaseDemandMapper = org.mockito.Mockito.mock(PurchaseDemandMapper.class);
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper = org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final RfqApplicationService rfqApplicationService = new RfqApplicationService(
      rfqMapper,
      quoteMapper,
      rfqDemandMapper,
      rfqInviteMapper,
      purchaseDemandMapper,
      buyerSupplierRelationMapper,
      tenantFeatureApplicationService,
      new RfqSourcingStatusTransition());

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
    when(rfqMapper.updateQuotingDetails("tenant-1", "rfq-1", "更新后的询价", deadline))
        .thenReturn(1);
    when(buyerSupplierRelationMapper.countByTenantSupplierAndStatus("tenant-1", "supplier-1", "已准入"))
        .thenReturn(1);
    when(buyerSupplierRelationMapper.countByTenantSupplierAndStatus("tenant-1", "supplier-2", "已准入"))
        .thenReturn(1);
    when(rfqDemandMapper.listDemandIds("tenant-1", "rfq-1")).thenReturn(List.of("demand-1"));
    when(rfqInviteMapper.listSupplierIds("tenant-1", "rfq-1")).thenReturn(List.of("supplier-1", "supplier-2"));
    when(quoteMapper.listByTenantAndRfq("tenant-1", "rfq-1")).thenReturn(List.of());

    var response = rfqApplicationService.update("rfq-1", new UpdateRfqRequest(
        "更新后的询价",
        List.of("supplier-1", "supplier-2"),
        deadline));

    assertThat(response.title()).isEqualTo("更新后的询价");
    assertThat(response.deadlineAt()).isEqualTo(deadline);
    assertThat(response.invitedSupplierIds()).containsExactly("supplier-1", "supplier-2");
    verify(rfqMapper).updateQuotingDetails("tenant-1", "rfq-1", "更新后的询价", deadline);
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
  void rejectsUpdatingRfqAfterAwardApprovalStarts() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.findByTenantAndId("tenant-1", "rfq-1"))
        .thenReturn(rfq("rfq-1", "定标审批中", OffsetDateTime.parse("2026-07-01T18:00:00+08:00")));

    assertThatThrownBy(() -> rfqApplicationService.update("rfq-1", new UpdateRfqRequest(
        "审批中的询价",
        List.of("supplier-1"),
        OffsetDateTime.parse("2026-07-05T18:00:00+08:00"))))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only quoting RFQ can be updated");

    verify(rfqMapper, never()).updateQuotingDetails(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any());
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
        OffsetDateTime.parse("2026-06-15T11:00:00+08:00"));
  }
}
