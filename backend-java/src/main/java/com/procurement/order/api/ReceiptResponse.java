package com.procurement.order.api;

import java.time.OffsetDateTime;

public record ReceiptResponse(
    String id,
    String tenantId,
    String orderId,
    String receiverId,
    String result,
    OffsetDateTime receivedAt) {
}
