package com.procurement.workflow.application;

import java.time.OffsetDateTime;

public record WorkflowStartResult(
    String workflowInstanceId,
    String flowableProcessInstanceId,
    String definitionVersionId,
    String firstTaskId,
    String status,
    OffsetDateTime createdAt) {
}
