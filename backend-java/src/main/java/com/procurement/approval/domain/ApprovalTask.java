package com.procurement.approval.domain;

import java.time.OffsetDateTime;

public record ApprovalTask(
    String id,
    String tenantId,
    String bizType,
    String bizId,
    String assigneeId,
    String status,
    String reviewComment,
    OffsetDateTime createdAt,
    OffsetDateTime actedAt) {
  public ApprovalTask(
      String id,
      String tenantId,
      String bizType,
      String bizId,
      String assigneeId,
      String status,
      OffsetDateTime createdAt,
      OffsetDateTime actedAt) {
    this(id, tenantId, bizType, bizId, assigneeId, status, null, createdAt, actedAt);
  }
}
