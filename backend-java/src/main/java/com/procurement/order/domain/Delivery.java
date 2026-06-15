package com.procurement.order.domain;

import java.time.OffsetDateTime;

public record Delivery(
    String id,
    String tenantId,
    String orderId,
    String supplierId,
    String carrier,
    String trackingNo,
    String status,
    OffsetDateTime createdAt) {
}
