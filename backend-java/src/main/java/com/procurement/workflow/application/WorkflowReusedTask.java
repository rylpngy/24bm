package com.procurement.workflow.application;

/**
 * 流程实例内按工号自动复用的任务明细。
 * 业务模块用它补齐节点表单快照，工作流层仍保留 Flowable 任务和历史真值。
 */
public record WorkflowReusedTask(
    String taskId,
    String nodeId,
    String nodeName,
    String actorId,
    String employeeNo,
    String sourceTaskId,
    String sourceNodeId,
    String comment) {
}
