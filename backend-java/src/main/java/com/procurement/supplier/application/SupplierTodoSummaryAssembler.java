package com.procurement.supplier.application;

import com.procurement.finance.api.InvoiceResponse;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.supplier.api.SupplierTodoSummaryResponse;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class SupplierTodoSummaryAssembler {
  private static final String RFQ_QUOTING_STATUS = "报价中";
  private static final String ORDER_PENDING_CONFIRMATION_STATUS = "待供应商确认";
  private static final String ORDER_PENDING_SHIPMENT_STATUS = "待发货";
  private static final String INVOICE_PENDING_PAYMENT_STATUS = "待付款";
  private static final String INVOICE_PARTIAL_PAYMENT_STATUS = "部分付款";

  public SupplierTodoSummaryResponse summarize(
      List<RfqResponse> opportunities,
      List<PurchaseOrderResponse> orders,
      List<InvoiceResponse> invoices) {
    return new SupplierTodoSummaryResponse(
        countRfqsByStatus(opportunities, RFQ_QUOTING_STATUS),
        countOrdersByStatus(orders, ORDER_PENDING_CONFIRMATION_STATUS),
        countOrdersByStatus(orders, ORDER_PENDING_SHIPMENT_STATUS),
        invoices.stream()
            .filter(invoice -> INVOICE_PENDING_PAYMENT_STATUS.equals(invoice.paymentStatus())
                || INVOICE_PARTIAL_PAYMENT_STATUS.equals(invoice.paymentStatus()))
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
