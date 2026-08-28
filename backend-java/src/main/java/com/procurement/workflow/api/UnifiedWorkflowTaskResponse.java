package com.procurement.workflow.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record UnifiedWorkflowTaskResponse(
    String taskId,
    String workflowInstanceId,
    String businessType,
    String businessId,
    String taskName,
    String taskDefinitionKey,
    String assigneeId,
    List<String> candidateUserIds,
    List<String> candidateRoleIds,
    BigDecimal amount,
    String departmentId,
    OffsetDateTime createdAt) {
}
