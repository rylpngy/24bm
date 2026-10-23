package com.procurement.attachment.api;

import java.time.OffsetDateTime;

public record AttachmentIntegrityResponse(String attachmentId, String status, String message,
    Long expectedSize, Long actualSize, OffsetDateTime checkedAt) {}
