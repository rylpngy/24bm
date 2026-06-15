package com.procurement.supplier.application;

import com.procurement.finance.application.InvoiceApplicationService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.sourcing.application.QuoteApplicationService;
import com.procurement.supplier.api.SupplierWorkspaceResponse;
import org.springframework.stereotype.Service;

@Service
public class SupplierWorkspaceApplicationService {
  private static final int WORKSPACE_NOTIFICATION_LIMIT = 20;

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
    return new SupplierWorkspaceResponse(
        supplierProfileApplicationService.getCurrentSupplierProfile(),
        quoteApplicationService.listSupplierRfqs(),
        quoteApplicationService.listSupplierQuotes(),
        purchaseOrderApplicationService.listCurrentSupplierOrders(),
        invoiceApplicationService.listCurrentSupplierInvoices(),
        notificationApplicationService.listCurrentSupplierUserNotifications(WORKSPACE_NOTIFICATION_LIMIT));
  }
}
