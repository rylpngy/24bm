package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.finance.api.CreateInvoiceRequest;
import com.procurement.finance.application.InvoiceApplicationService;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class FinanceInvoiceAuditLogTests {

  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final InvoiceMapper invoiceMapper = org.mockito.Mockito.mock(InvoiceMapper.class);
  private final AuditLogApplicationService auditLogApplicationService = org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final InvoiceApplicationService invoiceApplicationService = new InvoiceApplicationService(
      purchaseOrderMapper,
      invoiceMapper,
      auditLogApplicationService,
      tenantFeatureApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listSupplierInvoicesAppliesFiltersInsideCurrentSupplier() {
    TenantContext.set(null, "supplier-1", "supplier-user");
    when(invoiceMapper.listBySupplierFiltered("supplier-1", "待付款", "po-1"))
        .thenReturn(List.of());

    invoiceApplicationService.listCurrentSupplierInvoices("待付款", "po-1");

    verify(invoiceMapper).listBySupplierFiltered("supplier-1", "待付款", "po-1");
  }

  @Test
  void listSupplierPaymentAuditLogsRequiresInvoiceInsideCurrentSupplier() {
    TenantContext.set(null, "supplier-1", "supplier-user");
    when(invoiceMapper.findBySupplierAndId("supplier-1", "invoice-1"))
        .thenReturn(invoice("invoice-1"));
    when(auditLogApplicationService.listTenantTargetActions(
        "tenant-1",
        "invoice",
        "invoice-1",
        List.of("invoice.paid", "invoice.partial_paid"),
        50))
        .thenReturn(List.of());

    invoiceApplicationService.listCurrentSupplierPaymentAuditLogs("invoice-1");

    verify(auditLogApplicationService).listTenantTargetActions(
        "tenant-1",
        "invoice",
        "invoice-1",
        List.of("invoice.paid", "invoice.partial_paid"),
        50);
  }

  @Test
  void supplierInvoiceCreationRecordsAuditLogInOrderTenant() {
    TenantContext.set(null, "supplier-1", "supplier-user");
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order());
    when(invoiceMapper.findByTenantAndId(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> invoice(invocation.getArgument(1)));

    invoiceApplicationService.create("po-1", new CreateInvoiceRequest(BigDecimal.valueOf(100), "INV-001"));

    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("invoice.created"),
        org.mockito.ArgumentMatchers.eq("invoice"),
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("invoice-")));
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
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }

  private Invoice invoice(String id) {
    return new Invoice(
        id,
        "tenant-1",
        "supplier-1",
        "po-1",
        BigDecimal.valueOf(100),
        "INV-001",
        "待付款",
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }
}
