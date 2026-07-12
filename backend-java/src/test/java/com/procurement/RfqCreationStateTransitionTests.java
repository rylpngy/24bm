package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.domain.DataScope;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.api.CreateRfqRequest;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.sourcing.domain.Quote;
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
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;

class RfqCreationStateTransitionTests {

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
      org.mockito.Mockito.mock(com.procurement.demand.application.DirectDemandRegistrar.class),
      dataScopeService,
      buyerSupplierRelationMapper,
      supplierQualificationMapper,
      tenantFeatureApplicationService,
      new RfqSourcingStatusTransition(),
      auditLogApplicationService,
      notificationApplicationService, null);

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
        OffsetDateTime.now().plusDays(7), "", "", "最低价", "单一来源", null, null, "原厂唯一授权服务商", null, null, null, null);

    assertThatThrownBy(() -> rfqApplicationService.create(request))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Purchase demand already linked to an RFQ");
  }

  @Test
  void listRfqsAppliesFiltersInsideCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(dataScopeService.currentUserDataScope()).thenReturn(DataScope.unrestricted());
    when(rfqMapper.listByTenantFiltered("tenant-1", "报价中", "电脑", null, null))
        .thenReturn(List.of());

    rfqApplicationService.listCurrentTenantRfqs("报价中", "电脑");

    verify(rfqMapper).listByTenantFiltered("tenant-1", "报价中", "电脑", null, null);
  }

  @Test
  void listRfqsReturnsEmptyWithoutQueryWhenDepartmentScopeBlocksAll() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(dataScopeService.currentUserDataScope()).thenReturn(DataScope.departments(List.of()));

    var responses = rfqApplicationService.listCurrentTenantRfqs("报价中", "电脑");

    org.assertj.core.api.Assertions.assertThat(responses).isEmpty();
    verify(rfqMapper, never()).listByTenantFiltered(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any());
  }

  @Test
  void listRfqsRestrictsToVisibleDepartments() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(dataScopeService.currentUserDataScope())
        .thenReturn(DataScope.departments(List.of("dept-it", "dept-devops")));
    when(rfqMapper.listByTenantFiltered("tenant-1", null, null, List.of("dept-it", "dept-devops"), null))
        .thenReturn(List.of());

    rfqApplicationService.listCurrentTenantRfqs(null, null);

    verify(rfqMapper).listByTenantFiltered("tenant-1", null, null, List.of("dept-it", "dept-devops"), null);
  }

  @Test
  void listRfqsIncludesSubmittedQuotesForBuyerComparison() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(dataScopeService.currentUserDataScope()).thenReturn(DataScope.unrestricted());
    Rfq rfq = new Rfq(
        "rfq-1",
        "tenant-1",
        "办公电脑询价",
        "报价中",
        OffsetDateTime.parse("2026-06-20T18:00:00+08:00"),
        "buyer-user",
        null,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "", "", "最低价", null, 1, false, "询价", null, null, null, null, null);
    when(rfqMapper.listByTenantFiltered("tenant-1", null, null, null, null)).thenReturn(List.of(rfq));
    when(rfqDemandMapper.listDemandIds("tenant-1", "rfq-1")).thenReturn(List.of("demand-1"));
    when(rfqInviteMapper.listSupplierIds("tenant-1", "rfq-1")).thenReturn(List.of("supplier-1"));
    when(quoteMapper.listByTenantAndRfqAndRound("tenant-1", "rfq-1", 1))
        .thenReturn(List.of(new Quote(
            "quote-1",
            "tenant-1",
            "rfq-1",
            "supplier-1",
            BigDecimal.valueOf(98000),
            BigDecimal.valueOf(13),
            6,
            "已提交",
            OffsetDateTime.parse("2026-06-16T10:00:00+08:00"))));

    var responses = rfqApplicationService.listCurrentTenantRfqs();

    org.assertj.core.api.Assertions.assertThat(responses.get(0).quotes())
        .hasSize(1)
        .first()
        .extracting("id", "amount", "deliveryDays")
        .containsExactly("quote-1", BigDecimal.valueOf(98000), 6);
  }

  @Test
  void createTranslatesConcurrentDemandLinkDuplicateIntoBusinessError() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(purchaseDemandMapper.findByTenantAndId("tenant-1", "demand-1"))
        .thenReturn(demand("demand-1", "tenant-1", "已通过"));
    when(rfqDemandMapper.countByTenantAndDemand("tenant-1", "demand-1"))
        .thenReturn(0);
    when(buyerSupplierRelationMapper.countByTenantSupplierAndStatus("tenant-1", "supplier-1", "已准入"))
        .thenReturn(1);
    when(supplierQualificationMapper.listActiveBySupplier("supplier-1"))
        .thenReturn(List.of(qualification("qual-1", "supplier-1")));
    doThrow(new DuplicateKeyException("duplicate rfq demand link"))
        .when(rfqDemandMapper)
        .insert(anyString(), eq("tenant-1"), anyString(), eq("demand-1"));

    CreateRfqRequest request = new CreateRfqRequest(
        "办公电脑询价",
        List.of("demand-1"),
        List.of("supplier-1"),
        OffsetDateTime.now().plusDays(7), "", "", "最低价", "单一来源", null, null, "原厂唯一授权服务商", null, null, null, null);

    assertThatThrownBy(() -> rfqApplicationService.create(request))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Purchase demand already linked to an RFQ: demand-1");
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
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), java.time.LocalDate.parse("2026-07-15"), "常规", "采购用途说明", null);
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
