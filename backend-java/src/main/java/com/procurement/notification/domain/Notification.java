package com.procurement.notification.domain;

import java.time.OffsetDateTime;

public record Notification(
    String id,
    String tenantId,
    String recipientId,
    String title,
    String content,
    OffsetDateTime readAt,
    OffsetDateTime createdAt) {
}
