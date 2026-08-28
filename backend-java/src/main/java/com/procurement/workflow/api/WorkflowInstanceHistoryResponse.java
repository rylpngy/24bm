package com.procurement.workflow.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public record WorkflowInstanceHistoryResponse(
    String workflowInstanceId,
    String businessType,
    String businessId,
    String definitionVersionId,
    String flowableProcessInstanceId,
    String status,
    String initiatorId,
    String initiatorName,
    String completedBy,
    String completedByName,
    String departmentId,
    BigDecimal amount,
    Map<String, Object> formData,
    Map<String, Object> businessSnapshot,
    List<WorkflowAttachmentResponse> attachments,
    UnifiedWorkflowTaskResponse currentTask,
    OffsetDateTime createdAt,
    OffsetDateTime completedAt,
    List<WorkflowTaskEventResponse> events) {
}
