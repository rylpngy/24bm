package com.procurement.workflow.domain;

import java.time.OffsetDateTime;

// 工作流任务审计事件；与 Flowable 历史表互补，保留业务侧操作人、意见与审计语义。
public record WorkflowTaskEvent(
    String id,
    String tenantId,
    String workflowInstanceId,
    String flowableTaskId,
    String nodeId,
    String nodeName,
    String action,
    String actorId,
    String comment,
    OffsetDateTime createdAt) {
}
