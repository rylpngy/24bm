package com.procurement.ludongpoc.domain;

import java.time.OffsetDateTime;

public record LudongPocReviewRecord(
    String id,
    String tenantId,
    String applicationId,
    String workflowTaskId,
    String nodeId,
    String reviewerId,
    String decision,
    String reviewDataJson,
    String comment,
    OffsetDateTime reviewedAt) {
}
