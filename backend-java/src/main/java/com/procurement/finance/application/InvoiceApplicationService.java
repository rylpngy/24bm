package com.procurement.finance.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.api.CreateInvoiceRequest;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvoiceApplicationService {
  private static final String RECEIVED_STATUS = "已收货";
  private static final String PENDING_PAYMENT_STATUS = "待付款";

  private final PurchaseOrderMapper purchaseOrderMapper;
  private final InvoiceMapper invoiceMapper;

  public InvoiceApplicationService(PurchaseOrderMapper purchaseOrderMapper, InvoiceMapper invoiceMapper) {
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.invoiceMapper = invoiceMapper;
  }

  public List<InvoiceResponse> listCurrentSupplierInvoices() {
    String supplierId = TenantAccessGuard.requireSupplierId("invoice APIs");
    return invoiceMapper.listBySupplier(supplierId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public InvoiceResponse create(String orderId, CreateInvoiceRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("invoice APIs");
    PurchaseOrder order = purchaseOrderMapper.findBySupplierAndId(supplierId, orderId);
    if (order == null) {
      throw new IllegalArgumentException("Purchase order not found for supplier scope: " + orderId);
    }
    if (!RECEIVED_STATUS.equals(order.status())) {
      throw new IllegalStateException("Only received purchase orders can be invoiced: " + orderId);
    }

    String invoiceId = newId("invoice");
    invoiceMapper.insert(
        invoiceId,
        order.tenantId(),
        supplierId,
        order.id(),
        request.amount(),
        request.invoiceNo(),
        PENDING_PAYMENT_STATUS);

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
}
