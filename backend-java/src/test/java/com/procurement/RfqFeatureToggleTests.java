package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.DataScopeService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.api.CreateRfqRequest;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.infrastructure.QuoteLineItemMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.infrastructure.TenantFeatureMapper;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class RfqFeatureToggleTests {

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
  private final TenantFeatureMapper tenantFeatureMapper = org.mockito.Mockito.mock(TenantFeatureMapper.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      new TenantFeatureApplicationService(tenantFeatureMapper, new ObjectMapper());
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
  void createRejectsTenantWithoutRfqFeatureBeforeCreatingRfq() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(tenantFeatureMapper.findEnabledFeaturesJson("tenant-1"))
        .thenReturn("[\"order\",\"finance\"]");

    CreateRfqRequest request = new CreateRfqRequest(
        "办公电脑询价",
        List.of("demand-1"),
        List.of("supplier-1"),
        OffsetDateTime.parse("2026-06-20T18:00:00+08:00"), "", "", "最低价", "询价", null, null, null, null);

    assertThatThrownBy(() -> rfqApplicationService.create(request))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Feature is not enabled for tenant: rfq");

    verify(rfqMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
  }
}
