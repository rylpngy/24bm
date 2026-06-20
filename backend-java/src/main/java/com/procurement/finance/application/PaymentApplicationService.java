package com.procurement.finance.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.api.AuditLogResponse;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.api.RegisterPaymentRequest;
import com.procurement.finance.api.UpdateInvoicePaymentRequest;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.InvoiceAmountPolicy;
import com.procurement.finance.domain.InvoiceAuditAction;
import com.procurement.finance.domain.InvoicePaymentStatus;
import com.procurement.finance.domain.InvoicePaymentStatusTransition;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
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
  private final InvoiceMapper invoiceMapper;
  private final PurchaseOrderMapper purchaseOrderMapper;
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final InvoicePaymentStatusTransition invoicePaymentStatusTransition;

  public PaymentApplicationService(
      InvoiceMapper invoiceMapper,
      PurchaseOrderMapper purchaseOrderMapper,
      BuyerSupplierRelationMapper buyerSupplierRelationMapper,
      AuditLogApplicationService auditLogApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      NotificationApplicationService notificationApplicationService,
      InvoicePaymentStatusTransition invoicePaymentStatusTransition) {
    this.invoiceMapper = invoiceMapper;
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.buyerSupplierRelationMapper = buyerSupplierRelationMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.invoicePaymentStatusTransition = invoicePaymentStatusTransition;
  }

  public List<InvoiceResponse> listCurrentTenantInvoices() {
    String tenantId = TenantAccessGuard.requireTenantId("payment APIs");
    return invoiceMapper.listByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<InvoiceResponse> listCurrentTenantInvoices(String paymentStatus, String supplierId, String orderId) {
    String tenantId = TenantAccessGuard.requireTenantId("payment APIs");
    return invoiceMapper.listByTenantFiltered(
            tenantId,
            blankToNull(paymentStatus),
            blankToNull(supplierId),
            blankToNull(orderId))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  public List<AuditLogResponse> listCurrentTenantPaymentAuditLogs(String invoiceId) {
    return auditLogApplicationService.listCurrentTenantTargetActions(
        AuditTargetType.INVOICE,
        invoiceId,
        List.of(InvoiceAuditAction.PAID, InvoiceAuditAction.PARTIAL_PAID),
        50);
  }

  @Transactional
  public InvoiceResponse register(String invoiceId, RegisterPaymentRequest request) {
    return applyPaymentStatus(invoiceId, request.paymentStatus());
  }

  @Transactional
  public InvoiceResponse update(String invoiceId, UpdateInvoicePaymentRequest request) {
    return applyPaymentStatus(invoiceId, request.paymentStatus());
  }

  private InvoiceResponse applyPaymentStatus(String invoiceId, String paymentStatus) {
    String tenantId = TenantAccessGuard.requireTenantId("payment APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    Invoice invoice = invoiceMapper.findByTenantAndId(tenantId, invoiceId);
    if (invoice == null) {
      throw new IllegalArgumentException("Invoice not found in tenant scope: " + invoiceId);
    }
    invoicePaymentStatusTransition.requireSupportedTarget(paymentStatus);
    if (invoicePaymentStatusTransition.isIdempotentRegistration(invoice.paymentStatus(), paymentStatus)) {
      return toResponse(invoice);
    }
    invoicePaymentStatusTransition.requireTransition(invoice.paymentStatus(), paymentStatus, invoiceId);
    requireInvoiceAmountMatchesOrder(tenantId, invoice);
    requireSupplierPayable(tenantId, invoice);

    int updated = invoiceMapper.updatePaymentStatus(
        tenantId,
        invoiceId,
        invoice.paymentStatus(),
        paymentStatus);
    if (updated == 0) {
      throw new IllegalStateException("Invoice status changed before payment could be recorded: " + invoiceId);
    }
    auditLogApplicationService.recordTenantAction(
        InvoicePaymentStatus.PAID.equals(paymentStatus)
            ? InvoiceAuditAction.PAID
            : InvoiceAuditAction.PARTIAL_PAID,
        AuditTargetType.INVOICE,
        invoiceId);
    notificationApplicationService.notifyActiveSupplierUsers(
        tenantId,
        invoice.supplierId(),
        InvoicePaymentStatus.PAID.equals(paymentStatus)
            ? NotificationTitle.INVOICE_PAID
            : NotificationTitle.INVOICE_PARTIAL_PAID,
        "采购方已登记发票 " + invoice.invoiceNo() + " 的付款状态：" + paymentStatus + "。");
    return toResponse(invoiceMapper.findByTenantAndId(tenantId, invoiceId));
  }

  private InvoiceResponse toResponse(Invoice invoice) {
    return InvoiceResponseAssembler.from(invoice);
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
