package com.procurement.buyer.application;

import com.procurement.approval.api.PendingApprovalTaskResponse;
import com.procurement.buyer.api.BuyerTodoSummaryResponse;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.domain.InvoicePaymentStatus;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.order.domain.PurchaseOrderStatus;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.domain.RfqStatus;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class BuyerTodoSummaryAssembler {
  public BuyerTodoSummaryResponse summarize(
      List<RfqResponse> rfqs,
      List<PurchaseOrderResponse> orders,
      List<InvoiceResponse> invoices,
      List<PendingApprovalTaskResponse> pendingApprovals) {
    return new BuyerTodoSummaryResponse(
        pendingApprovals.size(),
        countRfqsByStatus(rfqs, RfqStatus.QUOTING),
        countOrdersByStatus(orders, PurchaseOrderStatus.SHIPPED),
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
