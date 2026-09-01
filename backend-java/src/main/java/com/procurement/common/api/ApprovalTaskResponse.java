package com.procurement.common.api;

import java.time.OffsetDateTime;

/**
 * 业务审批提交与旧兼容审批接口共用的轻量任务回执。
 *
 * <p>它只描述业务对象与审批状态，不承载任何特定业务模块字段，因此放在共享 API 契约中。
 */
public record ApprovalTaskResponse(
    String id,
    String tenantId,
    String bizType,
    String bizId,
    String assigneeId,
    String status,
    String reviewComment,
    OffsetDateTime createdAt) {
  public ApprovalTaskResponse(
      String id,
      String tenantId,
      String bizType,
      String bizId,
      String assigneeId,
      String status,
      OffsetDateTime createdAt) {
    this(id, tenantId, bizType, bizId, assigneeId, status, null, createdAt);
  }
}
