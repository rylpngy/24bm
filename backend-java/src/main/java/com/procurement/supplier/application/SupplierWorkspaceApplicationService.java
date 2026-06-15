package com.procurement.supplier.application;

import com.procurement.finance.application.InvoiceApplicationService;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.api.NotificationResponse;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.sourcing.api.QuoteResponse;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.application.QuoteApplicationService;
import com.procurement.supplier.api.SupplierTodoSummaryResponse;
import com.procurement.supplier.api.SupplierWorkspaceResponse;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class SupplierWorkspaceApplicationService {
  private static final int WORKSPACE_NOTIFICATION_LIMIT = 20;
  private static final String RFQ_QUOTING_STATUS = "报价中";
  private static final String ORDER_PENDING_CONFIRMATION_STATUS = "待供应商确认";
  private static final String ORDER_PENDING_SHIPMENT_STATUS = "待发货";
  private static final String INVOICE_PENDING_PAYMENT_STATUS = "待付款";
  private static final String INVOICE_PARTIAL_PAYMENT_STATUS = "部分付款";

  private final SupplierProfileApplicationService supplierProfileApplicationService;
  private final QuoteApplicationService quoteApplicationService;
  private final PurchaseOrderApplicationService purchaseOrderApplicationService;
  private final InvoiceApplicationService invoiceApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public SupplierWorkspaceApplicationService(
      SupplierProfileApplicationService supplierProfileApplicationService,
      QuoteApplicationService quoteApplicationService,
      PurchaseOrderApplicationService purchaseOrderApplicationService,
      InvoiceApplicationService invoiceApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.supplierProfileApplicationService = supplierProfileApplicationService;
    this.quoteApplicationService = quoteApplicationService;
    this.purchaseOrderApplicationService = purchaseOrderApplicationService;
    this.invoiceApplicationService = invoiceApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  public SupplierWorkspaceResponse load() {
    List<RfqResponse> opportunities = quoteApplicationService.listSupplierRfqs();
    List<QuoteResponse> quotes = quoteApplicationService.listSupplierQuotes();
    List<PurchaseOrderResponse> orders = purchaseOrderApplicationService.listCurrentSupplierOrders();
    List<InvoiceResponse> invoices = invoiceApplicationService.listCurrentSupplierInvoices();
    List<NotificationResponse> notifications =
        notificationApplicationService.listCurrentSupplierUserNotifications(WORKSPACE_NOTIFICATION_LIMIT);

    return new SupplierWorkspaceResponse(
        supplierProfileApplicationService.getCurrentSupplierProfile(),
        summarizeTodos(opportunities, orders, invoices),
        opportunities,
        quotes,
        orders,
        invoices,
        notifications);
  }

  private SupplierTodoSummaryResponse summarizeTodos(
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
