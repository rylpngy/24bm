package com.procurement.workflow.application;

import java.time.OffsetDateTime;

/** 业务模块在办理 Flowable 审批后所需的最小结果，不暴露 HTTP 历史 DTO。 */
public record WorkflowCompletionResult(
    String status,
    OffsetDateTime actedAt) {
}
