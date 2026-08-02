package com.procurement.notification.api;

import java.time.OffsetDateTime;

public record NotificationDeliveryResponse(
    String id,
    String channel,
    String target,
    String title,
    String status,
    String detail,
    OffsetDateTime dispatchedAt,
    // E-2 排障:尝试次数与最近错误。
    int attemptCount,
    String lastError) {
}
