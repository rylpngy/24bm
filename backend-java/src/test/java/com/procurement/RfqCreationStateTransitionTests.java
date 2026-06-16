package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.sourcing.api.CreateRfqRequest;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class RfqCreationStateTransitionTests {

  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final RfqDemandMapper rfqDemandMapper = org.mockito.Mockito.mock(RfqDemandMapper.class);
  private final RfqInviteMapper rfqInviteMapper = org.mockito.Mockito.mock(RfqInviteMapper.class);
  private final PurchaseDemandMapper purchaseDemandMapper = org.mockito.Mockito.mock(PurchaseDemandMapper.class);
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper = org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final RfqApplicationService rfqApplicationService = new RfqApplicationService(
      rfqMapper,
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
  void createRejectsDemandAlreadyLinkedToAnotherRfq() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "demand-1"))
        .thenReturn(demand("demand-1", "tenant-1", "已通过"));
    when(rfqDemandMapper.countByTenantAndDemand("tenant-1", "demand-1"))
        .thenReturn(1);

    CreateRfqRequest request = new CreateRfqRequest(
        "办公电脑询价",
        List.of("demand-1"),
        List.of("supplier-1"),
        OffsetDateTime.parse("2026-06-20T18:00:00+08:00"));

    assertThatThrownBy(() -> rfqApplicationService.create(request))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Purchase demand already linked to an RFQ");
  }

  @Test
  void listRfqsAppliesFiltersInsideCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(rfqMapper.listByTenantFiltered("tenant-1", "报价中", "电脑"))
        .thenReturn(List.of());

    rfqApplicationService.listCurrentTenantRfqs("报价中", "电脑");

    verify(rfqMapper).listByTenantFiltered("tenant-1", "报价中", "电脑");
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
}
