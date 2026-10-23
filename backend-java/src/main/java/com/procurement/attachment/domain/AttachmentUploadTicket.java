package com.procurement.attachment.domain;

import java.time.OffsetDateTime;

public record AttachmentUploadTicket(String storageKey, String tenantId, String userId,
    String ownerType, String ownerId, String fileName, String visibility, String tokenHash,
    String state, OffsetDateTime createdAt, OffsetDateTime expiresAt) {
}
