package com.procurement.platform.api;

import java.time.OffsetDateTime;

public record PlatformAnnouncementResponse(
    String id,
    String title,
    String content,
    String audience,
    String status,
    String publishedBy,
    OffsetDateTime createdAt) {
}
