package com.procurement.notification.domain;

import java.time.OffsetDateTime;

public record NotificationDelivery(
    String id,
    String tenantId,
    String channel,
    String target,
    String title,
    String content,
    String status,
    String detail,
    OffsetDateTime dispatchedAt) {
}
