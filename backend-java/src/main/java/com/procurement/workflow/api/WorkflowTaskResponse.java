package com.procurement.workflow.api;

public record WorkflowTaskResponse(
    String taskId,
    String name,
    String demandId,
    String processInstanceId,
    String createdAt) {
}
