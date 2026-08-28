package com.procurement.workflow.api;

import java.time.OffsetDateTime;

public record WorkflowAttachmentResponse(
    String id,
    String ownerType,
    String ownerId,
    String fileName,
    String visibility,
    OffsetDateTime createdAt) {
}
