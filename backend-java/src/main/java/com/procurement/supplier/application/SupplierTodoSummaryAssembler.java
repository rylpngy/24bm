package com.procurement.supplier.application;

import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.domain.InvoicePaymentStatus;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.order.domain.PurchaseOrderStatus;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.domain.RfqStatus;
import com.procurement.supplier.api.SupplierTodoSummaryResponse;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class SupplierTodoSummaryAssembler {
  public SupplierTodoSummaryResponse summarize(
      List<RfqResponse> opportunities,
      List<PurchaseOrderResponse> orders,
      List<InvoiceResponse> invoices) {
    return new SupplierTodoSummaryResponse(
        countRfqsByStatus(opportunities, RfqStatus.QUOTING),
        countOrdersByStatus(orders, PurchaseOrderStatus.PENDING_SUPPLIER_CONFIRMATION),
        countOrdersByStatus(orders, PurchaseOrderStatus.PENDING_SHIPMENT),
        invoices.stream()
            .filter(invoice -> InvoicePaymentStatus.PENDING_PAYMENT.equals(invoice.paymentStatus())
                || InvoicePaymentStatus.PARTIAL_PAID.equals(invoice.paymentStatus()))
            .count());
  }

  private long countRfqsByStatus(List<RfqResponse> rfqs, String status) {
    return rfqs.stream()
        .filter(rfq -> status.equals(rfq.status()))
        .count();
  }

  private long countOrdersByStatus(List<PurchaseOrderResponse> orders, String status) {
    return orders.stream()
        .filter(order -> status.equals(order.status()))
        .count();
  }
}
