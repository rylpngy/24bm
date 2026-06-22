package com.procurement.demand.api;

import java.time.OffsetDateTime;

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
