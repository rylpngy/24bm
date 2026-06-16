package com.procurement.finance.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.api.AuditLogResponse;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.api.CreateInvoiceRequest;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.InvoiceAuditAction;
import com.procurement.finance.domain.InvoicePaymentStatus;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.PurchaseOrderStatus;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvoiceApplicationService {
  private static final String FINANCE_FEATURE = "finance";
  private static final String INVOICE_CREATED_NOTIFICATION_TITLE = "供应商已登记发票";

  private final PurchaseOrderMapper purchaseOrderMapper;
  private final InvoiceMapper invoiceMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public InvoiceApplicationService(
      PurchaseOrderMapper purchaseOrderMapper,
      InvoiceMapper invoiceMapper,
      AuditLogApplicationService auditLogApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.invoiceMapper = invoiceMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  public List<InvoiceResponse> listCurrentSupplierInvoices() {
    String supplierId = TenantAccessGuard.requireSupplierId("invoice APIs");
    return invoiceMapper.listBySupplier(supplierId).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<InvoiceResponse> listCurrentSupplierInvoices(String paymentStatus, String orderId) {
    String supplierId = TenantAccessGuard.requireSupplierId("invoice APIs");
    return invoiceMapper.listBySupplierFiltered(
            supplierId,
            blankToNull(paymentStatus),
            blankToNull(orderId))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  public List<AuditLogResponse> listCurrentSupplierPaymentAuditLogs(String invoiceId) {
    String supplierId = TenantAccessGuard.requireSupplierId("invoice APIs");
    Invoice invoice = invoiceMapper.findBySupplierAndId(supplierId, invoiceId);
    if (invoice == null) {
      throw new IllegalArgumentException("Invoice not found for supplier scope: " + invoiceId);
    }
    return auditLogApplicationService.listTenantTargetActions(
        invoice.tenantId(),
        AuditTargetType.INVOICE,
        invoiceId,
        List.of(InvoiceAuditAction.PAID, InvoiceAuditAction.PARTIAL_PAID),
        50);
  }

  @Transactional
  public InvoiceResponse create(String orderId, CreateInvoiceRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("invoice APIs");
    PurchaseOrder order = purchaseOrderMapper.findBySupplierAndId(supplierId, orderId);
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found for supplier scope: " + orderId);
    }
    if (!PurchaseOrderStatus.RECEIVED.equals(order.status())) {
      throw new IllegalStateException("Only received purchase orders can be invoiced: " + orderId);
    }
    tenantFeatureApplicationService.requireEnabled(order.tenantId(), FINANCE_FEATURE);
    if (request.amount().compareTo(order.amount()) != 0) {
      throw new IllegalArgumentException("Invoice amount must equal purchase order amount: " + orderId);
    }
    if (invoiceMapper.countByTenantAndOrder(order.tenantId(), order.id()) > 0) {
      throw new IllegalStateException("Purchase order already has an invoice: " + orderId);
    }

    String invoiceId = newId("invoice");
    invoiceMapper.insert(
        invoiceId,
        order.tenantId(),
        supplierId,
        order.id(),
        request.amount(),
        request.invoiceNo(),
        InvoicePaymentStatus.PENDING_PAYMENT);
    auditLogApplicationService.recordTenantAction(
        order.tenantId(),
        InvoiceAuditAction.CREATED,
        AuditTargetType.INVOICE,
        invoiceId);
    notificationApplicationService.notifyActiveTenantUsers(
        order.tenantId(),
        INVOICE_CREATED_NOTIFICATION_TITLE,
        "采购订单 " + order.id() + " 已登记发票 " + request.invoiceNo() + "，金额：" + request.amount() + "。");

    return toResponse(invoiceMapper.findByTenantAndId(order.tenantId(), invoiceId));
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

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
