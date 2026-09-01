package com.procurement.workflow.application;

/** 跨业务模块办理 Flowable 任务时使用的稳定应用层上下文。 */
public record WorkflowTaskContext(
    String taskId,
    String businessType,
    String businessId,
    String taskDefinitionKey) {
}
