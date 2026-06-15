package com.procurement.attachment.domain;

import java.time.OffsetDateTime;

public record Attachment(
    String id,
    String tenantId,
    String ownerType,
    String ownerId,
    String fileName,
    String storageKey,
    String uploadedBy,
    String visibility,
    String status,
    OffsetDateTime createdAt) {
}
