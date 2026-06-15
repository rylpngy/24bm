package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.finance.api.CreateInvoiceRequest;
import com.procurement.finance.api.RegisterPaymentRequest;
import com.procurement.finance.application.InvoiceApplicationService;
import com.procurement.finance.application.PaymentApplicationService;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.api.CreatePurchaseOrderRequest;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.infrastructure.TenantFeatureMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class OrderFinanceFeatureToggleTests {

  private final AwardDecisionMapper awardDecisionMapper = org.mockito.Mockito.mock(AwardDecisionMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final InvoiceMapper invoiceMapper = org.mockito.Mockito.mock(InvoiceMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper =
      org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final TenantFeatureMapper tenantFeatureMapper = org.mockito.Mockito.mock(TenantFeatureMapper.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      new TenantFeatureApplicationService(tenantFeatureMapper, new ObjectMapper());

  private final PurchaseOrderApplicationService purchaseOrderApplicationService = new PurchaseOrderApplicationService(
      awardDecisionMapper,
      purchaseOrderMapper,
      auditLogApplicationService,
      notificationApplicationService,
      tenantFeatureApplicationService);
  private final InvoiceApplicationService invoiceApplicationService = new InvoiceApplicationService(
      purchaseOrderMapper,
      invoiceMapper,
      auditLogApplicationService,
      tenantFeatureApplicationService,
      notificationApplicationService);
  private final PaymentApplicationService paymentApplicationService = new PaymentApplicationService(
      invoiceMapper,
      purchaseOrderMapper,
      buyerSupplierRelationMapper,
      auditLogApplicationService,
      tenantFeatureApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void createPurchaseOrderRejectsTenantWithoutOrderFeatureBeforeCreatingOrder() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(tenantFeatureMapper.findEnabledFeaturesJson("tenant-1"))
        .thenReturn("[\"rfq\",\"finance\"]");

    assertThatThrownBy(() -> purchaseOrderApplicationService.createFromAward(
        new CreatePurchaseOrderRequest("award-1", LocalDate.parse("2026-06-20"))))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Feature is not enabled for tenant: order");

    verify(purchaseOrderMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any());
  }

  @Test
  void supplierInvoiceRejectsTenantWithoutFinanceFeatureBeforeCreatingInvoice() {
    TenantContext.set(null, "supplier-1", "supplier-user");
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "已收货"));
    when(tenantFeatureMapper.findEnabledFeaturesJson("tenant-1"))
        .thenReturn("[\"rfq\",\"order\"]");

    assertThatThrownBy(() -> invoiceApplicationService.create(
        "po-1",
        new CreateInvoiceRequest(BigDecimal.valueOf(100), "INV-1")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Feature is not enabled for tenant: finance");

    verify(invoiceMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void buyerPaymentRejectsTenantWithoutFinanceFeatureBeforeLoadingInvoice() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(tenantFeatureMapper.findEnabledFeaturesJson("tenant-1"))
        .thenReturn("[\"rfq\",\"order\"]");

    assertThatThrownBy(() -> paymentApplicationService.register(
        "invoice-1",
        new RegisterPaymentRequest("已付款")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Feature is not enabled for tenant: finance");

    verify(invoiceMapper, never()).findByTenantAndId(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @SuppressWarnings("unused")
  private AwardDecision award(String id, String tenantId, String status) {
    return new AwardDecision(
        id,
        tenantId,
        "rfq-1",
        "quote-1",
        "supplier-1",
        BigDecimal.valueOf(100),
        "价格最优",
        status,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }

  private PurchaseOrder order(String id, String tenantId, String supplierId, String status) {
    return new PurchaseOrder(
        id,
        tenantId,
        "rfq-1",
        supplierId,
        BigDecimal.valueOf(100),
        status,
        LocalDate.parse("2026-06-20"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }
}
