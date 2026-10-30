package com.procurement.workflow.domain;

import java.time.OffsetDateTime;

public record WorkflowAdditionalReview(String id, String tenantId, String workflowInstanceId,
    String flowableTaskId, String nodeId, String requestedBy, String requesterName,
    String reviewerId, String reviewerName, String reason, String status, String reviewData,
    OffsetDateTime createdAt, OffsetDateTime completedAt) {}
