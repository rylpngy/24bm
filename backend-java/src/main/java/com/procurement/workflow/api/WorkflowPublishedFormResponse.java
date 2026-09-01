package com.procurement.workflow.api;

import java.time.OffsetDateTime;

public record WorkflowPublishedFormResponse(
    String businessType,
    String definitionVersionId,
    String formSchema,
    OffsetDateTime publishedAt) {
}
