package com.procurement.workflow.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

// 业务对象与 Flowable 实例的受租户隔离映射。业务状态回调只能以该映射为入口。
public record WorkflowBusinessInstance(
    String id,
    String tenantId,
    String businessType,
    String businessId,
    String definitionVersionId,
    String flowableProcessInstanceId,
    String status,
    String initiatorId,
    String departmentId,
    BigDecimal amount,
    String formData,
    String businessSnapshot,
    String completedBy,
    OffsetDateTime completedAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
