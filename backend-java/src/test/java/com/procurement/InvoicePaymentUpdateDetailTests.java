package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.finance.api.UpdateInvoicePaymentRequest;
import com.procurement.finance.application.PaymentApplicationService;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.InvoicePaymentStatusTransition;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.InvoiceReconciliationMapper;
import com.procurement.finance.infrastructure.ThreeWayMatchMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class InvoicePaymentUpdateDetailTests {
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
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
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
          org.mockito.Mockito.mock(com.procurement.finance.infrastructure.InvoiceLineItemMapper.class));

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void updatesInvoicePaymentStatusFromBuyerDetailInsideTenant() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice("invoice-1", "待付款"))
        .thenReturn(invoice("invoice-1", "部分付款"));
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order(BigDecimal.valueOf(100)));
    when(invoiceMapper.updatePaymentStatus("tenant-1", "invoice-1", "待付款", "部分付款"))
        .thenReturn(1);

    var response = paymentApplicationService.update("invoice-1", new UpdateInvoicePaymentRequest("部分付款"));

    assertThat(response.paymentStatus()).isEqualTo("部分付款");
    verify(invoiceMapper).updatePaymentStatus("tenant-1", "invoice-1", "待付款", "部分付款");
    verify(auditLogApplicationService).recordTenantAction("invoice.partial_paid", "invoice", "invoice-1");
  }

  @Test
  void rejectsUpdatingAlreadyPaidInvoiceFromDetail() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice("invoice-1", "已付款"));

    assertThatThrownBy(() -> paymentApplicationService.update(
        "invoice-1",
        new UpdateInvoicePaymentRequest("部分付款")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Paid invoices cannot be changed");

    verify(invoiceMapper, never()).updatePaymentStatus(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  private Invoice invoice(String id, String paymentStatus) {
    return new Invoice(
        id,
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

  private PurchaseOrder order(BigDecimal amount) {
    return new PurchaseOrder(
        "po-1",
        "tenant-1",
        "rfq-1",
        "supplier-1",
        amount,
        "已收货",
        LocalDate.parse("2026-06-20"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "上海市浦东新区张江路100号", "王收货", "021-58880000", "货到验收30天内付款");
  }
}
