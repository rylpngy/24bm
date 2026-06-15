package com.procurement.supplier.api;

public record SupplierTodoSummaryResponse(
    long pendingQuoteCount,
    long pendingOrderConfirmationCount,
    long pendingShipmentCount,
    long pendingReceivableCount) {
}
