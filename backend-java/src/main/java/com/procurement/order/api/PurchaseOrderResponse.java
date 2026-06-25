package com.procurement.order.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record PurchaseOrderResponse(
    String id,
    String tenantId,
    String rfqId,
    String supplierId,
    BigDecimal amount,
    String status,
    LocalDate expectedReceiptDate,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    String deliveryAddress,
    String contactName,
    String contactPhone,
    String paymentTerms,
    List<OrderLineItemResponse> lineItems) {
}
