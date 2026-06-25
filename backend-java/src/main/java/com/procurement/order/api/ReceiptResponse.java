package com.procurement.order.api;

import java.time.OffsetDateTime;
import java.util.List;

public record ReceiptResponse(
    String id,
    String tenantId,
    String orderId,
    String receiverId,
    String result,
    OffsetDateTime receivedAt,
    Integer receivedQuantity,
    Integer qualifiedQuantity,
    String qualityNote,
    List<ReceiptLineItemResponse> lineItems) {
}
