package com.procurement.order.api;

import java.time.OffsetDateTime;

public record DeliveryResponse(
    String id,
    String tenantId,
    String orderId,
    String supplierId,
    String carrier,
    String trackingNo,
    String status,
    OffsetDateTime createdAt) {
}
