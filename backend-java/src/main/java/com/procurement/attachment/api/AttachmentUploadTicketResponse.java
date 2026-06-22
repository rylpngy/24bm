package com.procurement.attachment.api;

import java.time.OffsetDateTime;

public record AttachmentUploadTicketResponse(
    String ownerType,
    String ownerId,
    String fileName,
    String storageKey,
    String visibility,
    String uploadUrl,
    OffsetDateTime createdAt,
    OffsetDateTime expiresAt) {
}
