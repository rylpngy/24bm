package com.procurement.workflow.api;

import java.time.OffsetDateTime;

public record WorkflowTaskEventResponse(
    String id,
    String flowableTaskId,
    String nodeId,
    String nodeName,
    String action,
    String actorId,
    String actorName,
    String comment,
    OffsetDateTime createdAt) {
}
