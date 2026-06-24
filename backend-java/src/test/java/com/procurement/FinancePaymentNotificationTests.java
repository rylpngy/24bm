package com.procurement;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.finance.api.RegisterPaymentRequest;
import com.procurement.finance.application.PaymentApplicationService;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.InvoicePaymentStatusTransition;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.InvoiceReconciliationMapper;
import com.procurement.finance.infrastructure.ThreeWayMatchMapper;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.infrastructure.NotificationMapper;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.supplier.domain.SupplierUser;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierUserMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class FinancePaymentNotificationTests {

  private final InvoiceMapper invoiceMapper = org.mockito.Mockito.mock(InvoiceMapper.class);
  private final InvoiceReconciliationMapper invoiceReconciliationMapper =
      org.mockito.Mockito.mock(InvoiceReconciliationMapper.class);
  private final ThreeWayMatchMapper threeWayMatchMapper = org.mockito.Mockito.mock(ThreeWayMatchMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper =
      org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final NotificationMapper notificationMapper = org.mockito.Mockito.mock(NotificationMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final SupplierUserMapper supplierUserMapper = org.mockito.Mockito.mock(SupplierUserMapper.class);
  private final NotificationApplicationService notificationApplicationService =
      new NotificationApplicationService(notificationMapper, buyerUserMapper, supplierUserMapper);
  private final PaymentApplicationService paymentApplicationService = new PaymentApplicationService(
      invoiceMapper,
      invoiceReconciliationMapper,
      threeWayMatchMapper,
      purchaseOrderMapper,
      buyerSupplierRelationMapper,
      auditLogApplicationService,
      tenantFeatureApplicationService,
      notificationApplicationService,
      new InvoicePaymentStatusTransition());

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void paymentStatusChangeNotifiesActiveSupplierUsers() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice("待付款"))
        .thenReturn(invoice("已付款"));
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order());
    when(invoiceMapper.updatePaymentStatus("tenant-1", "invoice-1", "待付款", "已付款"))
        .thenReturn(1);
    when(supplierUserMapper.listBySupplier("supplier-1")).thenReturn(List.of(
        new SupplierUser("supplier-user-1", "supplier-1", "供应商管理员", "13900000001", "supplier@example.com", "启用", "role-supplier-admin"),
        new SupplierUser("disabled-supplier-user", "supplier-1", "停用用户", "13900000002", "disabled@example.com", "停用", "role-supplier-admin")));

    paymentApplicationService.register("invoice-1", new RegisterPaymentRequest("已付款"));

    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("supplier-user-1"),
        org.mockito.ArgumentMatchers.eq("发票已付款"),
        org.mockito.ArgumentMatchers.eq("采购方已登记发票 INV-001 的付款状态：已付款。"));
    verify(notificationMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("disabled-supplier-user"),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void duplicatePaidRegistrationDoesNotNotifySupplierAgain() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice("已付款"));

    assertThatThrownBy(() -> paymentApplicationService.register("invoice-1", new RegisterPaymentRequest("已付款")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Payment status already registered: invoice-1");

    verify(notificationMapper, never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  private Invoice invoice(String paymentStatus) {
    return new Invoice(
        "invoice-1",
        "tenant-1",
        "supplier-1",
        "po-1",
        BigDecimal.valueOf(100),
        "INV-001",
        paymentStatus,
        null,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "144031909110", java.time.LocalDate.parse("2026-06-01"), new java.math.BigDecimal("13.00"));
  }

  private PurchaseOrder order() {
    return new PurchaseOrder(
        "po-1",
        "tenant-1",
        "rfq-1",
        "supplier-1",
        BigDecimal.valueOf(100),
        "已收货",
        LocalDate.parse("2026-06-20"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "上海市浦东新区张江路100号", "王收货", "021-58880000", "货到验收30天内付款");
  }
}
