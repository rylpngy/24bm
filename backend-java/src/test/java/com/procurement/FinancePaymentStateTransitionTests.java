package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.finance.api.RegisterPaymentRequest;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.application.PaymentApplicationService;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class FinancePaymentStateTransitionTests {

  private final InvoiceMapper invoiceMapper = org.mockito.Mockito.mock(InvoiceMapper.class);
  private final AuditLogApplicationService auditLogApplicationService = org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper =
      org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final PaymentApplicationService paymentApplicationService = new PaymentApplicationService(
      invoiceMapper,
      buyerSupplierRelationMapper,
      auditLogApplicationService,
      tenantFeatureApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listBuyerInvoicesAppliesFiltersInsideCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.listByTenantFiltered("tenant-1", "待付款", "supplier-1", "po-1"))
        .thenReturn(List.of());

    paymentApplicationService.listCurrentTenantInvoices("待付款", "supplier-1", "po-1");

    verify(invoiceMapper).listByTenantFiltered("tenant-1", "待付款", "supplier-1", "po-1");
  }

  @Test
  void listPaymentAuditLogsAppliesInvoicePaymentScopeInsideCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(auditLogApplicationService.listCurrentTenantTargetActions(
        "invoice",
        "invoice-1",
        List.of("invoice.paid", "invoice.partial_paid"),
        50))
        .thenReturn(List.of());

    paymentApplicationService.listCurrentTenantPaymentAuditLogs("invoice-1");

    verify(auditLogApplicationService).listCurrentTenantTargetActions(
        "invoice",
        "invoice-1",
        List.of("invoice.paid", "invoice.partial_paid"),
        50);
  }

  @Test
  void paymentRejectsUnsupportedTargetStatus() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice("invoice-1", "tenant-1", "待付款"));

    assertThatThrownBy(() -> paymentApplicationService.register(
        "invoice-1",
        new RegisterPaymentRequest("已作废")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported payment status");
  }

  @Test
  void paymentRejectsAlreadyFinalInvoiceStatus() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice("invoice-1", "tenant-1", "已付款"));

    assertThatThrownBy(() -> paymentApplicationService.register(
        "invoice-1",
        new RegisterPaymentRequest("已付款")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only pending invoices can be paid");
  }

  @Test
  void paymentFailsWhenInvoiceStatusChangesBeforeAtomicUpdate() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice("invoice-1", "tenant-1", "待付款"));
    when(invoiceMapper.updatePaymentStatus("tenant-1", "invoice-1", "待付款", "已付款"))
        .thenReturn(0);

    assertThatThrownBy(() -> paymentApplicationService.register(
        "invoice-1",
        new RegisterPaymentRequest("已付款")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Invoice status changed before payment could be recorded");
  }

  @Test
  void paymentRejectsBlacklistedSupplierRelationBeforeStatusUpdate() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice("invoice-1", "tenant-1", "待付款"));
    when(buyerSupplierRelationMapper.countByTenantSupplierAndStatus("tenant-1", "supplier-1", "黑名单"))
        .thenReturn(1);

    assertThatThrownBy(() -> paymentApplicationService.register(
        "invoice-1",
        new RegisterPaymentRequest("已付款")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Blacklisted supplier cannot be paid");

    verify(invoiceMapper, org.mockito.Mockito.never()).updatePaymentStatus(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void paymentRecordsAuditLogAfterPaymentStatusUpdate() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice("invoice-1", "tenant-1", "待付款"))
        .thenReturn(invoice("invoice-1", "tenant-1", "已付款"));
    when(invoiceMapper.updatePaymentStatus("tenant-1", "invoice-1", "待付款", "已付款"))
        .thenReturn(1);

    InvoiceResponse response = paymentApplicationService.register(
        "invoice-1",
        new RegisterPaymentRequest("已付款"));

    org.assertj.core.api.Assertions.assertThat(response.paymentStatus()).isEqualTo("已付款");
    verify(auditLogApplicationService).recordTenantAction("invoice.paid", "invoice", "invoice-1");
  }

  private Invoice invoice(String id, String tenantId, String paymentStatus) {
    return new Invoice(
        id,
        tenantId,
        "supplier-1",
        "po-1",
        BigDecimal.valueOf(100),
        "INV-001",
        paymentStatus,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }
}
