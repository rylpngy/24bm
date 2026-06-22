package com.procurement.attachment.api;

import java.time.OffsetDateTime;

public record AttachmentDownloadLinkResponse(
    String attachmentId,
    String fileName,
    String storageKey,
    String downloadUrl,
    OffsetDateTime createdAt,
    OffsetDateTime expiresAt) {
}
