package com.procurement.notification.api;

import java.time.OffsetDateTime;

public record NotificationResponse(
    String id,
    String tenantId,
    String recipientId,
    String title,
    String content,
    boolean read,
    OffsetDateTime readAt,
    OffsetDateTime createdAt) {
}
