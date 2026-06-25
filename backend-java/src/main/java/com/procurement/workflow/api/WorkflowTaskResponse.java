package com.procurement.workflow.api;

import java.math.BigDecimal;

public record WorkflowTaskResponse(
    String taskId,
    String name,
    String bizType,
    String bizId,
    BigDecimal amount,
    String processInstanceId,
    String createdAt) {
}
