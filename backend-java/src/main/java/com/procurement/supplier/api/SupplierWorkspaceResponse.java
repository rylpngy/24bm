package com.procurement.supplier.api;

import com.procurement.finance.api.InvoiceResponse;
import com.procurement.notification.api.NotificationResponse;
import com.procurement.order.api.PurchaseOrderResponse;
import com.procurement.sourcing.api.QuoteResponse;
import com.procurement.sourcing.api.RfqResponse;
import java.util.List;

public record SupplierWorkspaceResponse(
    SupplierProfileResponse profile,
    SupplierTodoSummaryResponse todoSummary,
    List<RfqResponse> opportunities,
    List<QuoteResponse> quotes,
    List<PurchaseOrderResponse> orders,
    List<InvoiceResponse> invoices,
    List<NotificationResponse> notifications) {
}
