package com.procurement.workflow.api;

import java.time.OffsetDateTime;

public record WorkflowDefinitionVersionResponse(
    String id,
    String businessType,
    int versionNo,
    String status,
    String flowableProcessDefinitionId,
    OffsetDateTime publishedAt,
    String publishedBy) {
}
