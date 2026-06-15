package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.finance.api.RegisterPaymentRequest;
import com.procurement.finance.application.PaymentApplicationService;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.infrastructure.InvoiceMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class FinancePaymentStateTransitionTests {

  private final InvoiceMapper invoiceMapper = org.mockito.Mockito.mock(InvoiceMapper.class);
  private final PaymentApplicationService paymentApplicationService = new PaymentApplicationService(invoiceMapper);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
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
