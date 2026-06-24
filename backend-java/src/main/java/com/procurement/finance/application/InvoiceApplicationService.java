package com.procurement.finance.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.api.AuditLogResponse;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.api.CreateInvoiceRequest;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.api.InvoiceReconciliationResponse;
import com.procurement.finance.api.UpdateSupplierReceivableRequest;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.InvoiceAmountPolicy;
import com.procurement.finance.domain.InvoiceAuditAction;
import com.procurement.finance.domain.InvoiceCreationStatusPolicy;
import com.procurement.finance.domain.InvoicePaymentStatus;
import com.procurement.finance.domain.InvoiceReconciliation;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.InvoiceReconciliationMapper;
import com.procurement.finance.infrastructure.ThreeWayMatchMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.domain.PurchaseOrderDocumentUniquenessPolicy;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvoiceApplicationService {
  private final PurchaseOrderMapper purchaseOrderMapper;
  private final InvoiceMapper invoiceMapper;
  private final InvoiceReconciliationMapper invoiceReconciliationMapper;
  private final ThreeWayMatchMapper threeWayMatchMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public InvoiceApplicationService(
      PurchaseOrderMapper purchaseOrderMapper,
      InvoiceMapper invoiceMapper,
      InvoiceReconciliationMapper invoiceReconciliationMapper,
      ThreeWayMatchMapper threeWayMatchMapper,
      AuditLogApplicationService auditLogApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.invoiceMapper = invoiceMapper;
    this.invoiceReconciliationMapper = invoiceReconciliationMapper;
    this.threeWayMatchMapper = threeWayMatchMapper;
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

  public List<InvoiceReconciliationResponse> listCurrentSupplierReconciliations(String stage, String orderId) {
    String supplierId = TenantAccessGuard.requireSupplierId("invoice APIs");
    return invoiceReconciliationMapper.listBySupplierFiltered(
            supplierId,
            blankToNull(stage),
            blankToNull(orderId))
        .stream()
        .map(this::toReconciliationResponse)
        .toList();
  }

  @Transactional
  public InvoiceResponse create(String orderId, CreateInvoiceRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("invoice APIs");
    PurchaseOrder order = purchaseOrderMapper.findBySupplierAndId(supplierId, orderId);
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found for supplier scope: " + orderId);
    }
    InvoiceCreationStatusPolicy.requireReceivedOrder(order.status(), orderId);
    tenantFeatureApplicationService.requireEnabled(order.tenantId(), TenantFeatureKey.FINANCE);
    InvoiceAmountPolicy.requireInvoiceCreationAmountMatchesOrder(request.amount(), order.amount(), orderId);
    PurchaseOrderDocumentUniquenessPolicy.requireNoInvoice(
        invoiceMapper.countByTenantAndOrder(order.tenantId(), order.id()),
        orderId);

    String invoiceId = newId("invoice");
    invoiceMapper.insert(
        invoiceId,
        order.tenantId(),
        supplierId,
        order.id(),
        request.amount(),
        request.invoiceNo(),
        InvoicePaymentStatus.PENDING_PAYMENT,
        request.invoiceCode() == null ? "" : request.invoiceCode(),
        request.invoiceDate() == null ? java.time.LocalDate.now(java.time.ZoneId.of("Asia/Shanghai")) : request.invoiceDate(),
        request.taxRate() == null ? new java.math.BigDecimal("13.00") : request.taxRate());
    auditLogApplicationService.recordTenantAction(
        order.tenantId(),
        InvoiceAuditAction.CREATED,
        AuditTargetType.INVOICE,
        invoiceId);
    notificationApplicationService.notifyActiveTenantUsers(
        order.tenantId(),
        NotificationTitle.INVOICE_CREATED,
        "采购订单 " + order.id() + " 已登记发票 " + request.invoiceNo() + "，金额：" + request.amount() + "。");

    InvoiceResponse response = toResponse(invoiceMapper.findByTenantAndId(order.tenantId(), invoiceId));
    invoiceReconciliationMapper.insert(
        newId("recon"),
        order.tenantId(),
        invoiceId,
        supplierId,
        order.id(),
        response.reconciliationStage(),
        response.nextReconciliationAction());
    threeWayMatchMapper.upsertFromInvoice(newId("match"), order.tenantId(), invoiceId);
    return response;
  }

  @Transactional
  public InvoiceResponse updateReceivable(String invoiceId, UpdateSupplierReceivableRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("invoice APIs");
    Invoice invoice = invoiceMapper.findBySupplierAndId(supplierId, invoiceId);
    if (invoice == null) {
      throw new IllegalArgumentException("Invoice not found for supplier scope: " + invoiceId);
    }
    tenantFeatureApplicationService.requireEnabled(invoice.tenantId(), TenantFeatureKey.FINANCE);
    int updated = invoiceMapper.updateSupplierReconciliationNote(
        invoice.tenantId(),
        invoice.id(),
        supplierId,
        request.reconciliationNote());
    if (updated == 0) {
      throw new IllegalStateException("Invoice changed before reconciliation note could be recorded: " + invoiceId);
    }
    auditLogApplicationService.recordTenantAction(
        invoice.tenantId(),
        InvoiceAuditAction.RECEIVABLE_NOTE_UPDATED,
        AuditTargetType.INVOICE,
        invoiceId);
    notificationApplicationService.notifyActiveTenantUsers(
        invoice.tenantId(),
        NotificationTitle.INVOICE_CREATED,
        "发票 " + invoice.invoiceNo() + " 的供应商应收对账备注已更新：" + request.reconciliationNote() + "。");
    return toResponse(invoiceMapper.findBySupplierAndId(supplierId, invoiceId));
  }

  private InvoiceResponse toResponse(Invoice invoice) {
    return InvoiceResponseAssembler.from(
        invoice,
        purchaseOrderMapper.findByTenantAndId(invoice.tenantId(), invoice.orderId()));
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

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
