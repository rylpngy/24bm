package com.procurement.finance.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.api.AuditLogResponse;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.api.RegisterPaymentRequest;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentApplicationService {
  private static final String PENDING_PAYMENT_STATUS = "待付款";
  private static final String PAID_STATUS = "已付款";
  private static final String PARTIAL_PAID_STATUS = "部分付款";
  private static final String INVOICE_TARGET_TYPE = "invoice";
  private static final String INVOICE_PAID_ACTION = "invoice.paid";
  private static final String INVOICE_PARTIAL_PAID_ACTION = "invoice.partial_paid";
  private static final String FINANCE_FEATURE = "finance";
  private static final String BLACKLISTED_SUPPLIER_STATUS = "黑名单";

  private final InvoiceMapper invoiceMapper;
  private final PurchaseOrderMapper purchaseOrderMapper;
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;

  public PaymentApplicationService(
      InvoiceMapper invoiceMapper,
      PurchaseOrderMapper purchaseOrderMapper,
      BuyerSupplierRelationMapper buyerSupplierRelationMapper,
      AuditLogApplicationService auditLogApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService) {
    this.invoiceMapper = invoiceMapper;
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.buyerSupplierRelationMapper = buyerSupplierRelationMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
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
        INVOICE_TARGET_TYPE,
        invoiceId,
        List.of(INVOICE_PAID_ACTION, INVOICE_PARTIAL_PAID_ACTION),
        50);
  }

  @Transactional
  public InvoiceResponse register(String invoiceId, RegisterPaymentRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, FINANCE_FEATURE);
    Invoice invoice = invoiceMapper.findByTenantAndId(tenantId, invoiceId);
    if (invoice == null) {
      throw new IllegalArgumentException("Invoice not found in tenant scope: " + invoiceId);
    }
    if (!PENDING_PAYMENT_STATUS.equals(invoice.paymentStatus())) {
      throw new IllegalStateException("Only pending invoices can be paid: " + invoiceId);
    }
    if (!PAID_STATUS.equals(request.paymentStatus()) && !PARTIAL_PAID_STATUS.equals(request.paymentStatus())) {
      throw new IllegalArgumentException("Unsupported payment status: " + request.paymentStatus());
    }
    requireInvoiceAmountMatchesOrder(tenantId, invoice);
    requireSupplierPayable(tenantId, invoice);

    int updated = invoiceMapper.updatePaymentStatus(
        tenantId,
        invoiceId,
        PENDING_PAYMENT_STATUS,
        request.paymentStatus());
    if (updated == 0) {
      throw new IllegalStateException("Invoice status changed before payment could be recorded: " + invoiceId);
    }
    auditLogApplicationService.recordTenantAction(
        PAID_STATUS.equals(request.paymentStatus()) ? INVOICE_PAID_ACTION : INVOICE_PARTIAL_PAID_ACTION,
        INVOICE_TARGET_TYPE,
        invoiceId);
    return toResponse(invoiceMapper.findByTenantAndId(tenantId, invoiceId));
  }

  private InvoiceResponse toResponse(Invoice invoice) {
    return new InvoiceResponse(
        invoice.id(),
        invoice.tenantId(),
        invoice.supplierId(),
        invoice.orderId(),
        invoice.amount(),
        invoice.invoiceNo(),
        invoice.paymentStatus(),
        invoice.createdAt(),
        invoice.updatedAt());
  }

  private void requireSupplierPayable(String tenantId, Invoice invoice) {
    int blacklistedRelations = buyerSupplierRelationMapper.countByTenantSupplierAndStatus(
        tenantId,
        invoice.supplierId(),
        BLACKLISTED_SUPPLIER_STATUS);
    if (blacklistedRelations > 0) {
      throw new IllegalStateException("Blacklisted supplier cannot be paid: " + invoice.supplierId());
    }
  }

  private void requireInvoiceAmountMatchesOrder(String tenantId, Invoice invoice) {
    PurchaseOrder order = purchaseOrderMapper.findByTenantAndId(tenantId, invoice.orderId());
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found for invoice payment: " + invoice.orderId());
    }
    if (invoice.amount().compareTo(order.amount()) != 0) {
      throw new IllegalStateException("Invoice amount no longer matches purchase order amount: " + invoice.id());
    }
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
