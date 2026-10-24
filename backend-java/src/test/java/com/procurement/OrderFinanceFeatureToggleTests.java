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
import com.procurement.finance.domain.InvoicePaymentStatusTransition;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.InvoiceReconciliationMapper;
import com.procurement.finance.infrastructure.ThreeWayMatchMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.api.CreatePurchaseOrderRequest;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.infrastructure.TenantFeatureMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class OrderFinanceFeatureToggleTests {

  private final AwardDecisionMapper awardDecisionMapper = org.mockito.Mockito.mock(AwardDecisionMapper.class);
  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final InvoiceMapper invoiceMapper = org.mockito.Mockito.mock(InvoiceMapper.class);
  private final InvoiceReconciliationMapper invoiceReconciliationMapper =
      org.mockito.Mockito.mock(InvoiceReconciliationMapper.class);
  private final ThreeWayMatchMapper threeWayMatchMapper = org.mockito.Mockito.mock(ThreeWayMatchMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper =
      org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final TenantFeatureMapper tenantFeatureMapper = org.mockito.Mockito.mock(TenantFeatureMapper.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      new TenantFeatureApplicationService(tenantFeatureMapper, new ObjectMapper());
  private final com.procurement.finance.application.PaymentAuthorizationService authorization =
      org.mockito.Mockito.mock(com.procurement.finance.application.PaymentAuthorizationService.class);

  private final PurchaseOrderApplicationService purchaseOrderApplicationService = new PurchaseOrderApplicationService(
          TestOrderAccess.unrestricted(),
      new com.procurement.sourcing.application.OrderAwardQueryService(awardDecisionMapper, rfqMapper),
      purchaseOrderMapper,
      auditLogApplicationService,
      notificationApplicationService,
      tenantFeatureApplicationService,
      new PurchaseOrderStatusTransition(),
          org.mockito.Mockito.mock(com.procurement.order.application.OrderLineItemApplicationService.class),
          org.mockito.Mockito.mock(com.procurement.sourcing.application.RfqDemandLinkQueryService.class));
  private final InvoiceApplicationService invoiceApplicationService = new InvoiceApplicationService(
      purchaseOrderMapper,
        org.mockito.Mockito.mock(com.procurement.order.infrastructure.ReceiptMapper.class),
      invoiceMapper,
      invoiceReconciliationMapper,
      threeWayMatchMapper,
      auditLogApplicationService,
      tenantFeatureApplicationService,
      notificationApplicationService,
          org.mockito.Mockito.mock(com.procurement.order.infrastructure.OrderLineItemMapper.class),
          org.mockito.Mockito.mock(com.procurement.finance.infrastructure.InvoiceLineItemMapper.class));
  private final PaymentApplicationService paymentApplicationService = new PaymentApplicationService(
      invoiceMapper,
      invoiceReconciliationMapper,
      threeWayMatchMapper,
      purchaseOrderMapper,
        org.mockito.Mockito.mock(com.procurement.order.infrastructure.ReceiptMapper.class),
      buyerSupplierRelationMapper,
      auditLogApplicationService,
      tenantFeatureApplicationService,
      notificationApplicationService,
      new InvoicePaymentStatusTransition(),
          org.mockito.Mockito.mock(com.procurement.finance.infrastructure.InvoiceLineItemMapper.class),
      TestFinanceAccess.unrestricted(),
      authorization);

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
        .hasMessageContaining("本企业未开通该功能模块(order)");

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
        new CreateInvoiceRequest(BigDecimal.valueOf(100), "INV-1", null, null, null)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("本企业未开通该功能模块(finance)");

    verify(invoiceMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any());
  }

  @Test
  void existingInvoicePaymentStillChecksInvoiceScopeWhenFinanceIsOff() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(tenantFeatureMapper.findEnabledFeaturesJson("tenant-1"))
        .thenReturn("[\"rfq\",\"order\"]");

    assertThatThrownBy(() -> paymentApplicationService.register(
        "invoice-1",
        new RegisterPaymentRequest("已付款")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Invoice not found in tenant scope");

    verify(invoiceMapper).findByTenantAndId("tenant-1", "invoice-1");
  }

  @Test
  void supplierCanConfirmExistingOrderAfterModuleShutdown() {
    TenantContext.set(null, "supplier-1", "supplier-user");
    when(tenantFeatureMapper.findEnabledFeaturesJson("tenant-1")).thenReturn("[]");
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "待供应商确认"));
    when(purchaseOrderMapper.updateStatus("tenant-1", "po-1", "待供应商确认", "待发货")).thenReturn(1);
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "待发货"));
    org.assertj.core.api.Assertions.assertThatCode(() ->
        org.assertj.core.api.Assertions.assertThat(purchaseOrderApplicationService.confirmCurrentSupplierOrder("po-1").status())
            .isEqualTo("待发货")).doesNotThrowAnyException();
  }

  @Test
  void existingInvoiceCanSettleAfterFinanceShutdownWithoutBypassingAuthorization() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(tenantFeatureMapper.findEnabledFeaturesJson("tenant-1")).thenReturn("[]");
    var before = invoice("待付款");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1")).thenReturn(before, invoice("已付款"));
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "已收货"));
    when(invoiceMapper.updatePaymentStatus("tenant-1", "invoice-1", "待付款", "已付款")).thenReturn(1);
    org.assertj.core.api.Assertions.assertThat(paymentApplicationService.register("invoice-1",
        new RegisterPaymentRequest("已付款")).paymentStatus()).isEqualTo("已付款");
    verify(authorization).requireReady(before, "已付款");
    verify(authorization).recordPayment(before, null, null, null);
  }

  @Test
  void financeShutdownDoesNotBypassExistingPaymentApprovalGuards() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(tenantFeatureMapper.findEnabledFeaturesJson("tenant-1")).thenReturn("[]");
    var before = invoice("待付款");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1")).thenReturn(before);
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order("po-1", "tenant-1", "supplier-1", "已收货"));
    when(authorization.requireReady(before, "已付款")).thenThrow(new IllegalStateException("付款申请尚未审批通过"));
    assertThatThrownBy(() -> paymentApplicationService.register("invoice-1", new RegisterPaymentRequest("已付款")))
        .hasMessageContaining("尚未审批通过");
    verify(invoiceMapper, never()).updatePaymentStatus(org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
  }

  private com.procurement.finance.domain.Invoice invoice(String status) {
    var time = OffsetDateTime.parse("2026-06-15T10:00:00+08:00");
    return new com.procurement.finance.domain.Invoice("invoice-1", "tenant-1", "supplier-1", "po-1",
        BigDecimal.valueOf(100), "INV-1", status, null, time, time, null, null, null);
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
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "上海市浦东新区张江路100号", "王收货", "021-58880000", "货到验收30天内付款");
  }
}
