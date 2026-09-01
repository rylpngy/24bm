package com.procurement.workflow.application;

import java.time.OffsetDateTime;
import java.util.List;

/** 业务模块在办理 Flowable 审批后所需的最小结果，不暴露 HTTP 历史 DTO。 */
public record WorkflowCompletionResult(
    String status,
    OffsetDateTime actedAt,
    List<WorkflowReusedTask> reusedTasks) {

  public WorkflowCompletionResult {
    reusedTasks = reusedTasks == null ? List.of() : List.copyOf(reusedTasks);
  }
}
