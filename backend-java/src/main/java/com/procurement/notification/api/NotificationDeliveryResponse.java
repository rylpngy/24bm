package com.procurement.notification.api;

import java.time.OffsetDateTime;

public record NotificationDeliveryResponse(
    String id,
    String channel,
    String target,
    String title,
    String status,
    String detail,
    OffsetDateTime dispatchedAt) {
}
