package com.procurement.finance.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.api.AuditLogResponse;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.api.InvoiceLineItemResponse;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.api.InvoiceReconciliationResponse;
import com.procurement.finance.api.RegisterPaymentRequest;
import com.procurement.finance.api.UpdateInvoicePaymentRequest;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.InvoiceAmountPolicy;
import com.procurement.finance.domain.InvoiceAuditAction;
import com.procurement.finance.domain.InvoicePaymentStatus;
import com.procurement.finance.domain.InvoicePaymentStatusTransition;
import com.procurement.finance.domain.InvoiceLineItem;
import com.procurement.finance.domain.InvoiceReconciliation;
import com.procurement.finance.infrastructure.InvoiceLineItemMapper;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.InvoiceReconciliationMapper;
import com.procurement.finance.infrastructure.ThreeWayMatchMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.order.infrastructure.ReceiptMapper;
import com.procurement.supplier.domain.BuyerSupplierPaymentPolicy;
import com.procurement.supplier.domain.BuyerSupplierRelationStatus;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentApplicationService {
  private final FinanceAccessService financeAccess;
  private final PaymentAuthorizationService paymentAuthorization;
  private final InvoiceMapper invoiceMapper;
  private final InvoiceReconciliationMapper invoiceReconciliationMapper;
  private final ThreeWayMatchMapper threeWayMatchMapper;
  private final PurchaseOrderMapper purchaseOrderMapper;
  private final ReceiptMapper receiptMapper;
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final InvoicePaymentStatusTransition invoicePaymentStatusTransition;
  private final InvoiceLineItemMapper invoiceLineItemMapper;

  public PaymentApplicationService(
      InvoiceMapper invoiceMapper,
      InvoiceReconciliationMapper invoiceReconciliationMapper,
      ThreeWayMatchMapper threeWayMatchMapper,
      PurchaseOrderMapper purchaseOrderMapper,
      ReceiptMapper receiptMapper,
      BuyerSupplierRelationMapper buyerSupplierRelationMapper,
      AuditLogApplicationService auditLogApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      NotificationApplicationService notificationApplicationService,
      InvoicePaymentStatusTransition invoicePaymentStatusTransition,
      InvoiceLineItemMapper invoiceLineItemMapper,
      FinanceAccessService financeAccess,
      PaymentAuthorizationService paymentAuthorization) {
    this.financeAccess = financeAccess;
    this.paymentAuthorization = paymentAuthorization;
    this.invoiceMapper = invoiceMapper;
    this.invoiceReconciliationMapper = invoiceReconciliationMapper;
    this.threeWayMatchMapper = threeWayMatchMapper;
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.receiptMapper = receiptMapper;
    this.buyerSupplierRelationMapper = buyerSupplierRelationMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.invoicePaymentStatusTransition = invoicePaymentStatusTransition;
    this.invoiceLineItemMapper = invoiceLineItemMapper;
  }

  public List<InvoiceResponse> listCurrentTenantInvoices() {
    String tenantId = TenantAccessGuard.requireTenantId("payment APIs");
    // The workspace aggregates multiple modules; unavailable finance data stays empty.
    if (!financeAccess.canRead()) return List.of();
    var scope = financeAccess.readScope();
    return invoiceMapper.listVisible(tenantId, null, null, null, scope).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<InvoiceResponse> listCurrentTenantInvoices(String paymentStatus, String supplierId, String orderId) {
    String tenantId = TenantAccessGuard.requireTenantId("payment APIs");
    var scope = financeAccess.readScope();
    return invoiceMapper.listVisible(
            tenantId,
            blankToNull(paymentStatus),
            blankToNull(supplierId),
            blankToNull(orderId), scope)
        .stream()
        .map(this::toResponse)
        .toList();
  }

  public List<AuditLogResponse> listCurrentTenantPaymentAuditLogs(String invoiceId) {
    financeAccess.requireInvoice(invoiceId, "buyer:invoice:read");
    return auditLogApplicationService.listCurrentTenantTargetActions(
        AuditTargetType.INVOICE,
        invoiceId,
        List.of(InvoiceAuditAction.PAID, InvoiceAuditAction.PARTIAL_PAID),
        50);
  }

  public List<InvoiceReconciliationResponse> listCurrentTenantReconciliations(
      String stage,
      String supplierId,
      String orderId) {
    String tenantId = TenantAccessGuard.requireTenantId("payment APIs");
    var scope = financeAccess.readScope();
    return invoiceReconciliationMapper.listVisible(
            tenantId,
            blankToNull(stage),
            blankToNull(supplierId),
            blankToNull(orderId), scope)
        .stream()
        .map(this::toReconciliationResponse)
        .toList();
  }

  @Transactional
  public InvoiceResponse register(String invoiceId, RegisterPaymentRequest request) {
    return applyPaymentStatus(invoiceId, request.paymentStatus(), request.releaseEvidenceNo(), request.releaseRemark());
  }

  @Transactional
  public InvoiceResponse update(String invoiceId, UpdateInvoicePaymentRequest request) {
    return applyPaymentStatus(invoiceId, request.paymentStatus());
  }

  private InvoiceResponse applyPaymentStatus(String invoiceId, String paymentStatus) {
    return applyPaymentStatus(invoiceId, paymentStatus, null, null);
  }

  private InvoiceResponse applyPaymentStatus(String invoiceId, String paymentStatus, String evidence, String remark) {
    String tenantId = TenantAccessGuard.requireTenantId("payment APIs");
    financeAccess.requireInvoice(invoiceId, "buyer:payment:register");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    Invoice invoice = invoiceMapper.findByTenantAndId(tenantId, invoiceId);
    if (invoice == null) {
      throw new IllegalArgumentException("Invoice not found in tenant scope: " + invoiceId);
    }
    invoicePaymentStatusTransition.requireSupportedTarget(paymentStatus);
    invoicePaymentStatusTransition.requireTransition(invoice.paymentStatus(), paymentStatus, invoiceId);
    requireInvoiceAmountMatchesOrder(tenantId, invoice);
    requireSupplierPayable(tenantId, invoice);
    var approvedRequest = paymentAuthorization.requireReady(invoice, paymentStatus);

    InvoiceResponse response = writePaymentStatus(invoice, paymentStatus);
    paymentAuthorization.recordPayment(invoice, approvedRequest, evidence, remark);
    return response;
  }

  public void validateAmountPayment(Invoice invoice) {
    financeAccess.requireInvoice(invoice.id(), "buyer:payment:register");
    requireFinanceEnabled(invoice.tenantId());
    requireInvoiceAmountMatchesOrder(invoice.tenantId(), invoice);
    requireSupplierPayable(invoice.tenantId(), invoice);
  }

  public void requireFinanceEnabled(String tenantId) {
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
  }

  @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
  public InvoiceResponse syncAmountPayment(Invoice invoice, java.math.BigDecimal balance, boolean reversal) {
    return writePaymentStatus(invoice, PaymentAuthorizationService.status(balance, invoice.amount()), reversal);
  }

  private InvoiceResponse writePaymentStatus(Invoice invoice, String paymentStatus) {
    return writePaymentStatus(invoice, paymentStatus, false);
  }

  private InvoiceResponse writePaymentStatus(Invoice invoice, String paymentStatus, boolean reversal) {
    String tenantId = invoice.tenantId();
    String invoiceId = invoice.id();

    int updated = invoiceMapper.updatePaymentStatus(
        tenantId,
        invoiceId,
        invoice.paymentStatus(),
        paymentStatus);
    if (updated == 0) {
      throw new IllegalStateException("Invoice status changed before payment could be recorded: " + invoiceId);
    }
    if (!reversal) auditLogApplicationService.recordTenantAction(
        InvoicePaymentStatus.PAID.equals(paymentStatus)
            ? InvoiceAuditAction.PAID
            : InvoiceAuditAction.PARTIAL_PAID,
        AuditTargetType.INVOICE,
        invoiceId);
    notificationApplicationService.notifyActiveSupplierUsers(
        tenantId,
        invoice.supplierId(),
        reversal ? "付款登记已冲销" : InvoicePaymentStatus.PAID.equals(paymentStatus)
            ? NotificationTitle.INVOICE_PAID
            : NotificationTitle.INVOICE_PARTIAL_PAID,
        (reversal ? "采购方已冲销发票 " : "采购方已登记发票 ") + invoice.invoiceNo() + " 的付款状态：" + paymentStatus + "。");
    InvoiceResponse response = toResponse(invoiceMapper.findByTenantAndId(tenantId, invoiceId));
    invoiceReconciliationMapper.updateStageByInvoice(
        tenantId,
        invoiceId,
        response.reconciliationStage(),
        response.nextReconciliationAction());
    threeWayMatchMapper.upsertFromInvoice("match-" + java.util.UUID.randomUUID(), tenantId, invoiceId);
    return response;
  }

  private InvoiceResponse toResponse(Invoice invoice) {
    List<InvoiceLineItem> lines =
        invoiceLineItemMapper.listByInvoice(invoice.tenantId(), invoice.id());
    List<InvoiceLineItemResponse> lineItems =
        lines == null
            ? List.of()
            : lines.stream()
                .map(
                    l ->
                        new InvoiceLineItemResponse(
                            l.id(), l.orderLineId(), l.description(), l.unit(),
                            l.quantity(), l.unitPrice(), l.lineAmount()))
                .toList();
    return InvoiceResponseAssembler.from(
        invoice,
        purchaseOrderMapper.findByTenantAndId(invoice.tenantId(), invoice.orderId()),
        invoiceMapper.findAggregateReceipt(invoice.tenantId(), invoice.orderId()),
        lineItems,
        threeWayMatchMapper.paymentBlockingReason(invoice.tenantId(), invoice.id()));
  }

  private InvoiceReconciliationResponse toReconciliationResponse(InvoiceReconciliation reconciliation) {
    return new InvoiceReconciliationResponse(
        reconciliation.id(),
        reconciliation.tenantId(),
        "REC-" + reconciliation.invoiceId(),
        reconciliation.invoiceId(),
        reconciliation.supplierId(),
        reconciliation.orderId(),
        reconciliation.stage(),
        reconciliation.nextAction(),
        reconciliation.orderAmount(),
        reconciliation.invoiceAmount(),
        reconciliation.varianceAmount(),
        reconciliation.receiptStatus(),
        reconciliation.paymentStatus(),
        reconciliation.createdAt(),
        reconciliation.updatedAt());
  }

  private void requireSupplierPayable(String tenantId, Invoice invoice) {
    BuyerSupplierPaymentPolicy.requirePayable(
        buyerSupplierRelationMapper.countByTenantSupplierAndStatus(
            tenantId,
            invoice.supplierId(),
            BuyerSupplierRelationStatus.BLACKLISTED),
        invoice.supplierId());
  }

  private void requireInvoiceAmountMatchesOrder(String tenantId, Invoice invoice) {
    PurchaseOrder order = purchaseOrderMapper.findByTenantAndId(tenantId, invoice.orderId());
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found for invoice payment: " + invoice.orderId());
    }
    InvoiceAmountPolicy.requirePaymentAmountStillMatchesOrder(invoice.amount(), order.amount(), invoice.id());
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
