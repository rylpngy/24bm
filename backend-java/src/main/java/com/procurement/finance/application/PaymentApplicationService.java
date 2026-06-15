package com.procurement.finance.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.api.RegisterPaymentRequest;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.infrastructure.InvoiceMapper;
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

  private final InvoiceMapper invoiceMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;

  public PaymentApplicationService(
      InvoiceMapper invoiceMapper,
      AuditLogApplicationService auditLogApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService) {
    this.invoiceMapper = invoiceMapper;
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

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
