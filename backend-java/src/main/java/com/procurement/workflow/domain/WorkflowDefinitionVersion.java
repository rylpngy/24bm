package com.procurement.workflow.domain;

import java.time.OffsetDateTime;

// 已发布流程的不可变快照。每一次发布都对应一个明确的 Flowable deployment 与版本号。
public record WorkflowDefinitionVersion(
    String id,
    String tenantId,
    String processDefinitionId,
    String businessType,
    int versionNo,
    String status,
    String formSchema,
    String flowSchema,
    String flowableProcessKey,
    String flowableProcessDefinitionId,
    String flowableDeploymentId,
    String publishedBy,
    OffsetDateTime publishedAt,
    OffsetDateTime createdAt) {
}
