package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.finance.api.RegisterPaymentRequest;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.api.InvoiceReconciliationResponse;
import com.procurement.finance.api.UpdateSupplierReceivableRequest;
import com.procurement.finance.application.InvoiceApplicationService;
import com.procurement.finance.application.PaymentApplicationService;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.InvoiceReconciliation;
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
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class FinancePaymentStateTransitionTests {

  private final InvoiceMapper invoiceMapper = org.mockito.Mockito.mock(InvoiceMapper.class);
  private final InvoiceReconciliationMapper invoiceReconciliationMapper =
      org.mockito.Mockito.mock(InvoiceReconciliationMapper.class);
  private final ThreeWayMatchMapper threeWayMatchMapper = org.mockito.Mockito.mock(ThreeWayMatchMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final AuditLogApplicationService auditLogApplicationService = org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper =
      org.mockito.Mockito.mock(BuyerSupplierRelationMapper.class);
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

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listBuyerInvoicesAppliesFiltersInsideCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.listByTenantFiltered("tenant-1", "待付款", "supplier-1", "po-1"))
        .thenReturn(List.of(invoice("invoice-1", "tenant-1", "待付款")));
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order(BigDecimal.valueOf(100)));

    InvoiceResponse response = paymentApplicationService.listCurrentTenantInvoices("待付款", "supplier-1", "po-1").getFirst();

    verify(invoiceMapper).listByTenantFiltered("tenant-1", "待付款", "supplier-1", "po-1");
    org.assertj.core.api.Assertions.assertThat(response.orderAmount()).isEqualByComparingTo("100");
    org.assertj.core.api.Assertions.assertThat(response.varianceAmount()).isEqualByComparingTo("0");
    org.assertj.core.api.Assertions.assertThat(response.receiptStatus()).isEqualTo("已收货");
    org.assertj.core.api.Assertions.assertThat(response.reconciliationStatus()).isEqualTo("三单一致");
    org.assertj.core.api.Assertions.assertThat(response.reconciliationNo()).isEqualTo("REC-invoice-1");
    org.assertj.core.api.Assertions.assertThat(response.reconciliationStage()).isEqualTo("待付款");
    org.assertj.core.api.Assertions.assertThat(response.nextReconciliationAction()).isEqualTo("登记付款");
  }

  @Test
  void listBuyerReconciliationsUsesIndependentLedgerInsideCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceReconciliationMapper.listByTenantFiltered("tenant-1", "待付款", "supplier-1", "po-1"))
        .thenReturn(List.of(reconciliation("recon-1", "invoice-1", "待付款", "登记付款")));

    InvoiceReconciliationResponse response = paymentApplicationService
        .listCurrentTenantReconciliations("待付款", "supplier-1", "po-1")
        .getFirst();

    verify(invoiceReconciliationMapper).listByTenantFiltered("tenant-1", "待付款", "supplier-1", "po-1");
    org.assertj.core.api.Assertions.assertThat(response.id()).isEqualTo("recon-1");
    org.assertj.core.api.Assertions.assertThat(response.reconciliationNo()).isEqualTo("REC-invoice-1");
    org.assertj.core.api.Assertions.assertThat(response.invoiceId()).isEqualTo("invoice-1");
    org.assertj.core.api.Assertions.assertThat(response.orderAmount()).isEqualByComparingTo("100");
    org.assertj.core.api.Assertions.assertThat(response.invoiceAmount()).isEqualByComparingTo("100");
    org.assertj.core.api.Assertions.assertThat(response.varianceAmount()).isEqualByComparingTo("0");
    org.assertj.core.api.Assertions.assertThat(response.receiptStatus()).isEqualTo("已收货");
    org.assertj.core.api.Assertions.assertThat(response.paymentStatus()).isEqualTo("待付款");
    org.assertj.core.api.Assertions.assertThat(response.stage()).isEqualTo("待付款");
    org.assertj.core.api.Assertions.assertThat(response.nextAction()).isEqualTo("登记付款");
  }

  @Test
  void listSupplierReconciliationsUsesIndependentLedgerInsideCurrentSupplier() {
    TenantContext.set(null, "supplier-1", "supplier-user");
    when(invoiceReconciliationMapper.listBySupplierFiltered("supplier-1", "待付款", "po-1"))
        .thenReturn(List.of(reconciliation("recon-1", "invoice-1", "待付款", "登记付款")));

    InvoiceReconciliationResponse response = invoiceApplicationService
        .listCurrentSupplierReconciliations("待付款", "po-1")
        .getFirst();

    verify(invoiceReconciliationMapper).listBySupplierFiltered("supplier-1", "待付款", "po-1");
    org.assertj.core.api.Assertions.assertThat(response.id()).isEqualTo("recon-1");
    org.assertj.core.api.Assertions.assertThat(response.reconciliationNo()).isEqualTo("REC-invoice-1");
    org.assertj.core.api.Assertions.assertThat(response.invoiceId()).isEqualTo("invoice-1");
    org.assertj.core.api.Assertions.assertThat(response.orderAmount()).isEqualByComparingTo("100");
    org.assertj.core.api.Assertions.assertThat(response.invoiceAmount()).isEqualByComparingTo("100");
    org.assertj.core.api.Assertions.assertThat(response.varianceAmount()).isEqualByComparingTo("0");
    org.assertj.core.api.Assertions.assertThat(response.receiptStatus()).isEqualTo("已收货");
    org.assertj.core.api.Assertions.assertThat(response.paymentStatus()).isEqualTo("待付款");
    org.assertj.core.api.Assertions.assertThat(response.stage()).isEqualTo("待付款");
    org.assertj.core.api.Assertions.assertThat(response.nextAction()).isEqualTo("登记付款");
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
  void paymentRejectsRegisteringSameFinalStatusAgainWithoutAudit() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice("invoice-1", "tenant-1", "已付款"));

    assertThatThrownBy(() -> paymentApplicationService.register(
        "invoice-1",
        new RegisterPaymentRequest("已付款")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Payment status already registered");

    verify(invoiceMapper, org.mockito.Mockito.never()).updatePaymentStatus(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
    verify(auditLogApplicationService, org.mockito.Mockito.never()).recordTenantAction(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void paymentRejectsChangingAlreadyPaidInvoiceBackToPartialPayment() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice("invoice-1", "tenant-1", "已付款"));

    assertThatThrownBy(() -> paymentApplicationService.register(
        "invoice-1",
        new RegisterPaymentRequest("部分付款")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Paid invoices cannot be changed");
  }

  @Test
  void paymentFailsWhenInvoiceStatusChangesBeforeAtomicUpdate() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice("invoice-1", "tenant-1", "待付款"));
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order(BigDecimal.valueOf(100)));
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
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order(BigDecimal.valueOf(100)));
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
  void paymentRejectsInvoiceAmountDifferentFromOrderAmountBeforeStatusUpdate() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice("invoice-1", "tenant-1", "待付款"));
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order(BigDecimal.valueOf(99)));

    assertThatThrownBy(() -> paymentApplicationService.register(
        "invoice-1",
        new RegisterPaymentRequest("已付款")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Invoice amount no longer matches purchase order amount");

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
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order(BigDecimal.valueOf(100)));
    when(invoiceMapper.updatePaymentStatus("tenant-1", "invoice-1", "待付款", "已付款"))
        .thenReturn(1);

    InvoiceResponse response = paymentApplicationService.register(
        "invoice-1",
        new RegisterPaymentRequest("已付款"));

    org.assertj.core.api.Assertions.assertThat(response.paymentStatus()).isEqualTo("已付款");
    verify(invoiceReconciliationMapper).updateStageByInvoice("tenant-1", "invoice-1", "已完成", "归档对账");
    verify(auditLogApplicationService).recordTenantAction("invoice.paid", "invoice", "invoice-1");
  }

  @Test
  void invoiceCreationPersistsInitialReconciliationStatement() {
    TenantContext.set(null, "supplier-1", "supplier-user");
    PurchaseOrder order = order(BigDecimal.valueOf(100));
    when(purchaseOrderMapper.findBySupplierAndId("supplier-1", "po-1"))
        .thenReturn(order);
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order);
    when(invoiceMapper.countByTenantAndOrder("tenant-1", "po-1"))
        .thenReturn(0);
    when(invoiceMapper.findByTenantAndId(org.mockito.ArgumentMatchers.eq("tenant-1"), org.mockito.ArgumentMatchers.startsWith("invoice-")))
        .thenAnswer(invocation -> invoice(invocation.getArgument(1), "tenant-1", "待付款"));

    InvoiceResponse response = invoiceApplicationService.create(
        "po-1",
        new com.procurement.finance.api.CreateInvoiceRequest(BigDecimal.valueOf(100), "INV-001", null, null, null));

    org.assertj.core.api.Assertions.assertThat(response.reconciliationStage()).isEqualTo("待付款");
    org.mockito.ArgumentCaptor<String> invoiceIdCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(invoiceReconciliationMapper).insert(
        org.mockito.ArgumentMatchers.startsWith("recon-"),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        invoiceIdCaptor.capture(),
        org.mockito.ArgumentMatchers.eq("supplier-1"),
        org.mockito.ArgumentMatchers.eq("po-1"),
        org.mockito.ArgumentMatchers.eq("待付款"),
        org.mockito.ArgumentMatchers.eq("登记付款"));
    org.assertj.core.api.Assertions.assertThat(invoiceIdCaptor.getValue()).startsWith("invoice-");
  }

  @Test
  void partialPaymentCanBeCompletedToPaid() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice("invoice-1", "tenant-1", "部分付款"))
        .thenReturn(invoice("invoice-1", "tenant-1", "已付款"));
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order(BigDecimal.valueOf(100)));
    when(invoiceMapper.updatePaymentStatus("tenant-1", "invoice-1", "部分付款", "已付款"))
        .thenReturn(1);

    InvoiceResponse response = paymentApplicationService.register(
        "invoice-1",
        new RegisterPaymentRequest("已付款"));

    org.assertj.core.api.Assertions.assertThat(response.paymentStatus()).isEqualTo("已付款");
    verify(auditLogApplicationService).recordTenantAction("invoice.paid", "invoice", "invoice-1");
  }

  @Test
  void supplierCanUpdateReceivableReconciliationNoteInsideOwnScope() {
    TenantContext.set(null, "supplier-1", "supplier-user");
    when(invoiceMapper.findBySupplierAndId("supplier-1", "invoice-1"))
        .thenReturn(invoice("invoice-1", "tenant-1", "部分付款"))
        .thenReturn(invoice("invoice-1", "tenant-1", "部分付款", "已与采购方确认 6 月底付尾款"));
    when(purchaseOrderMapper.findByTenantAndId("tenant-1", "po-1"))
        .thenReturn(order(BigDecimal.valueOf(100)));
    when(invoiceMapper.updateSupplierReconciliationNote(
        "tenant-1",
        "invoice-1",
        "supplier-1",
        "已与采购方确认 6 月底付尾款"))
        .thenReturn(1);

    InvoiceResponse response = invoiceApplicationService.updateReceivable(
        "invoice-1",
        new UpdateSupplierReceivableRequest("已与采购方确认 6 月底付尾款"));

    org.assertj.core.api.Assertions.assertThat(response.reconciliationNote()).isEqualTo("已与采购方确认 6 月底付尾款");
    org.assertj.core.api.Assertions.assertThat(response.paymentStatus()).isEqualTo("部分付款");
    org.assertj.core.api.Assertions.assertThat(response.dueDate()).isEqualTo(LocalDate.now().plusDays(25));
    org.assertj.core.api.Assertions.assertThat(response.overdue()).isFalse();
    org.assertj.core.api.Assertions.assertThat(response.overdueDays()).isZero();
    org.assertj.core.api.Assertions.assertThat(response.orderAmount()).isEqualByComparingTo("100");
    org.assertj.core.api.Assertions.assertThat(response.varianceAmount()).isEqualByComparingTo("0");
    org.assertj.core.api.Assertions.assertThat(response.receiptStatus()).isEqualTo("已收货");
    org.assertj.core.api.Assertions.assertThat(response.reconciliationStatus()).isEqualTo("三单一致");
    org.assertj.core.api.Assertions.assertThat(response.reconciliationNo()).isEqualTo("REC-invoice-1");
    org.assertj.core.api.Assertions.assertThat(response.reconciliationStage()).isEqualTo("待付款");
    org.assertj.core.api.Assertions.assertThat(response.nextReconciliationAction()).isEqualTo("登记付款");
    verify(invoiceMapper).updateSupplierReconciliationNote(
        "tenant-1",
        "invoice-1",
        "supplier-1",
        "已与采购方确认 6 月底付尾款");
    verify(invoiceMapper, org.mockito.Mockito.never()).updatePaymentStatus(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  private Invoice invoice(String id, String tenantId, String paymentStatus) {
    return invoice(id, tenantId, paymentStatus, null);
  }

  private Invoice invoice(String id, String tenantId, String paymentStatus, String reconciliationNote) {
    return new Invoice(
        id,
        tenantId,
        "supplier-1",
        "po-1",
        BigDecimal.valueOf(100),
        "INV-001",
        paymentStatus,
        reconciliationNote,
        // 相对时间:写死日期会随现实时间流逝翻车(dueDate=createdAt+30,须恒在未来)。
        OffsetDateTime.now().minusDays(5),
        OffsetDateTime.now().minusDays(5), "144031909110", java.time.LocalDate.now().minusDays(14), new java.math.BigDecimal("13.00"));
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

  private InvoiceReconciliation reconciliation(String id, String invoiceId, String stage, String nextAction) {
    return new InvoiceReconciliation(
        id,
        "tenant-1",
        invoiceId,
        "supplier-1",
        "po-1",
        stage,
        nextAction,
        BigDecimal.valueOf(100),
        BigDecimal.valueOf(100),
        BigDecimal.ZERO,
        "已收货",
        "待付款",
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }
}
