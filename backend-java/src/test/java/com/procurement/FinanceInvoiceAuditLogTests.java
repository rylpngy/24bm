package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.finance.api.CreateInvoiceRequest;
import com.procurement.finance.api.UpdateSupplierReceivableRequest;
import com.procurement.finance.application.InvoiceApplicationService;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.InvoiceReconciliationMapper;
import com.procurement.finance.infrastructure.ThreeWayMatchMapper;
import com.procurement.notification.application.NotificationApplicationService;
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
  private final InvoiceReconciliationMapper invoiceReconciliationMapper =
      org.mockito.Mockito.mock(InvoiceReconciliationMapper.class);
  private final ThreeWayMatchMapper threeWayMatchMapper = org.mockito.Mockito.mock(ThreeWayMatchMapper.class);
  private final AuditLogApplicationService auditLogApplicationService = org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final com.procurement.order.infrastructure.OrderLineItemMapper orderLineItemMapper =
      org.mockito.Mockito.mock(com.procurement.order.infrastructure.OrderLineItemMapper.class);
  private final com.procurement.finance.infrastructure.InvoiceLineItemMapper invoiceLineItemMapper =
      org.mockito.Mockito.mock(com.procurement.finance.infrastructure.InvoiceLineItemMapper.class);
  private final InvoiceApplicationService invoiceApplicationService = new InvoiceApplicationService(
      purchaseOrderMapper,
        org.mockito.Mockito.mock(com.procurement.order.infrastructure.ReceiptMapper.class),
      invoiceMapper,
      invoiceReconciliationMapper,
      threeWayMatchMapper,
      auditLogApplicationService,
      tenantFeatureApplicationService,
      notificationApplicationService,
      orderLineItemMapper,
      invoiceLineItemMapper);

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

    invoiceApplicationService.create("po-1", new CreateInvoiceRequest(BigDecimal.valueOf(100), "INV-001", null, null, null));

    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("invoice.created"),
        org.mockito.ArgumentMatchers.eq("invoice"),
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("invoice-")));
  }

  @Test
  void supplierInvoiceCreationCopiesOrderLineItemsIntoInvoiceLines() {
    TenantContext.set(null, "supplier-1", "supplier-user");
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1")).thenReturn(order());
    when(invoiceMapper.findByTenantAndId(
            org.mockito.ArgumentMatchers.eq("tenant-1"), org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> invoice(invocation.getArgument(1)));
    when(orderLineItemMapper.listByOrder("tenant-1", "po-1"))
        .thenReturn(List.of(new com.procurement.order.domain.OrderLineItem(
            "oli-1", "tenant-1", "po-1", "网络机柜", "台",
            BigDecimal.valueOf(4), BigDecimal.valueOf(25), BigDecimal.valueOf(100), 0)));

    invoiceApplicationService.create("po-1", new CreateInvoiceRequest(BigDecimal.valueOf(100), "INV-001", null, null, null));

    // 发票行项保留 order_line_id 并冗余订单行项的 品名/单位/数量/单价/行金额。
    verify(invoiceLineItemMapper).insert(
        org.mockito.ArgumentMatchers.startsWith("ili-"),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("oli-1"),
        org.mockito.ArgumentMatchers.eq("网络机柜"),
        org.mockito.ArgumentMatchers.eq("台"),
        org.mockito.ArgumentMatchers.eq(BigDecimal.valueOf(4)),
        org.mockito.ArgumentMatchers.eq(BigDecimal.valueOf(25)),
        org.mockito.ArgumentMatchers.eq(BigDecimal.valueOf(100)),
        org.mockito.ArgumentMatchers.eq(0));
  }

  @Test
  void supplierReceivableNoteUpdateRecordsAuditLogInOrderTenant() {
    TenantContext.set(null, "supplier-1", "supplier-user");
    when(invoiceMapper.findBySupplierAndId("supplier-1", "invoice-1"))
        .thenReturn(invoice("invoice-1"))
        .thenReturn(invoiceWithNote("invoice-1", "已与采购方确认月底付款"));
    when(invoiceMapper.updateSupplierReconciliationNote(
        "tenant-1",
        "invoice-1",
        "supplier-1",
        "已与采购方确认月底付款"))
        .thenReturn(1);

    invoiceApplicationService.updateReceivable(
        "invoice-1",
        new UpdateSupplierReceivableRequest("已与采购方确认月底付款"));

    verify(auditLogApplicationService).recordTenantAction(
        "tenant-1",
        "invoice.receivable_note_updated",
        "invoice",
        "invoice-1");
  }

  @Test
  void supplierInvoiceCreationRejectsAmountDifferentFromOrderAmountBeforeInsert() {
    TenantContext.set(null, "supplier-1", "supplier-user");
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order());

    assertThatThrownBy(() -> invoiceApplicationService.create(
        "po-1",
        new CreateInvoiceRequest(BigDecimal.valueOf(99), "INV-001", null, null, null)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Invoice amount must equal purchase order amount");

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
  void supplierInvoiceCreationRejectsDuplicateInvoiceForSameOrderBeforeInsert() {
    TenantContext.set(null, "supplier-1", "supplier-user");
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order());
    when(invoiceMapper.countByTenantAndOrder("tenant-1", "po-1"))
        .thenReturn(1);

    assertThatThrownBy(() -> invoiceApplicationService.create(
        "po-1",
        new CreateInvoiceRequest(BigDecimal.valueOf(100), "INV-001", null, null, null)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Purchase order already has an invoice");

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

  private Invoice invoice(String id) {
    return invoiceWithNote(id, null);
  }

  private Invoice invoiceWithNote(String id, String reconciliationNote) {
    return new Invoice(
        id,
        "tenant-1",
        "supplier-1",
        "po-1",
        BigDecimal.valueOf(100),
        "INV-001",
        "待付款",
        reconciliationNote,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"), "144031909110", java.time.LocalDate.parse("2026-06-01"), new java.math.BigDecimal("13.00"));
  }
}
