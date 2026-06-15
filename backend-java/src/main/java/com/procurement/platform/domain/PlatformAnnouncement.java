package com.procurement.platform.domain;

import java.time.OffsetDateTime;

public record PlatformAnnouncement(
    String id,
    String title,
    String content,
    String audience,
    String status,
    String publishedBy,
    OffsetDateTime createdAt) {
}
