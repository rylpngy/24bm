package com.procurement.workflow.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record WorkflowInstanceLedgerResponse(
    String workflowInstanceId,
    String businessType,
    String businessId,
    String definitionVersionId,
    String status,
    String initiatorId,
    String initiatorName,
    String completedBy,
    String completedByName,
    String departmentId,
    BigDecimal amount,
    UnifiedWorkflowTaskResponse currentTask,
    OffsetDateTime createdAt,
    OffsetDateTime completedAt,
    OffsetDateTime updatedAt) {
}
