package com.procurement.supplier.application;

import com.procurement.finance.application.InvoiceApplicationService;
import com.procurement.finance.api.InvoiceResponse;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.api.NotificationResponse;
import com.procurement.order.api.DeliveryResponse;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.order.application.DeliveryApplicationService;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.sourcing.api.QuoteResponse;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.application.QuoteApplicationService;
import com.procurement.supplier.api.SupplierWorkspaceResponse;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class SupplierWorkspaceApplicationService {
  private static final int WORKSPACE_NOTIFICATION_LIMIT = 20;

  private final SupplierProfileApplicationService supplierProfileApplicationService;
  private final QuoteApplicationService quoteApplicationService;
  private final PurchaseOrderApplicationService purchaseOrderApplicationService;
  private final DeliveryApplicationService deliveryApplicationService;
  private final InvoiceApplicationService invoiceApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final SupplierTodoSummaryAssembler supplierTodoSummaryAssembler;

  public SupplierWorkspaceApplicationService(
      SupplierProfileApplicationService supplierProfileApplicationService,
      QuoteApplicationService quoteApplicationService,
      PurchaseOrderApplicationService purchaseOrderApplicationService,
      DeliveryApplicationService deliveryApplicationService,
      InvoiceApplicationService invoiceApplicationService,
      NotificationApplicationService notificationApplicationService,
      SupplierTodoSummaryAssembler supplierTodoSummaryAssembler) {
    this.supplierProfileApplicationService = supplierProfileApplicationService;
    this.quoteApplicationService = quoteApplicationService;
    this.purchaseOrderApplicationService = purchaseOrderApplicationService;
    this.deliveryApplicationService = deliveryApplicationService;
    this.invoiceApplicationService = invoiceApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.supplierTodoSummaryAssembler = supplierTodoSummaryAssembler;
  }

  public SupplierWorkspaceResponse load() {
    List<RfqResponse> opportunities = quoteApplicationService.listSupplierRfqs();
    List<QuoteResponse> quotes = quoteApplicationService.listSupplierQuotes();
    List<PurchaseOrderResponse> orders = purchaseOrderApplicationService.listCurrentSupplierOrders();
    List<DeliveryResponse> deliveries = deliveryApplicationService.listCurrentSupplierDeliveries(null, null);
    List<InvoiceResponse> invoices = invoiceApplicationService.listCurrentSupplierInvoices();
    List<NotificationResponse> notifications =
        notificationApplicationService.listCurrentSupplierUserNotifications(WORKSPACE_NOTIFICATION_LIMIT);

    return new SupplierWorkspaceResponse(
        supplierProfileApplicationService.getCurrentSupplierProfile(),
        supplierTodoSummaryAssembler.summarize(opportunities, orders, invoices),
        opportunities,
        quotes,
        orders,
        deliveries,
        invoices,
        notifications);
  }
}
