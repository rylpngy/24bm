package com.procurement.buyer.application;

import com.procurement.approval.api.PendingApprovalTaskResponse;
import com.procurement.buyer.api.BuyerTodoSummaryResponse;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.sourcing.api.RfqResponse;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class BuyerTodoSummaryAssembler {
  private static final String RFQ_QUOTING_STATUS = "报价中";
  private static final String ORDER_SHIPPED_STATUS = "已发货";
  private static final String INVOICE_PENDING_PAYMENT_STATUS = "待付款";
  private static final String INVOICE_PARTIAL_PAYMENT_STATUS = "部分付款";

  public BuyerTodoSummaryResponse summarize(
      List<RfqResponse> rfqs,
      List<PurchaseOrderResponse> orders,
      List<InvoiceResponse> invoices,
      List<PendingApprovalTaskResponse> pendingApprovals) {
    return new BuyerTodoSummaryResponse(
        pendingApprovals.size(),
        countRfqsByStatus(rfqs, RFQ_QUOTING_STATUS),
        countOrdersByStatus(orders, ORDER_SHIPPED_STATUS),
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
