package com.procurement.supplier.application;

import com.procurement.finance.application.InvoiceApplicationService;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.sourcing.application.QuoteApplicationService;
import com.procurement.supplier.api.SupplierWorkspaceResponse;
import org.springframework.stereotype.Service;

@Service
public class SupplierWorkspaceApplicationService {
  private final SupplierProfileApplicationService supplierProfileApplicationService;
  private final QuoteApplicationService quoteApplicationService;
  private final PurchaseOrderApplicationService purchaseOrderApplicationService;
  private final InvoiceApplicationService invoiceApplicationService;

  public SupplierWorkspaceApplicationService(
      SupplierProfileApplicationService supplierProfileApplicationService,
      QuoteApplicationService quoteApplicationService,
      PurchaseOrderApplicationService purchaseOrderApplicationService,
      InvoiceApplicationService invoiceApplicationService) {
    this.supplierProfileApplicationService = supplierProfileApplicationService;
    this.quoteApplicationService = quoteApplicationService;
    this.purchaseOrderApplicationService = purchaseOrderApplicationService;
    this.invoiceApplicationService = invoiceApplicationService;
  }

  public SupplierWorkspaceResponse load() {
    return new SupplierWorkspaceResponse(
        supplierProfileApplicationService.getCurrentSupplierProfile(),
        quoteApplicationService.listSupplierRfqs(),
        quoteApplicationService.listSupplierQuotes(),
        purchaseOrderApplicationService.listCurrentSupplierOrders(),
        invoiceApplicationService.listCurrentSupplierInvoices());
  }
}
