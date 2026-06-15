package com.procurement.attachment.api;

import java.time.OffsetDateTime;

public record AttachmentResponse(
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
