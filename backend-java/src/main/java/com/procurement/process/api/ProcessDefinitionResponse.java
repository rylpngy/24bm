package com.procurement.process.api;

import java.time.OffsetDateTime;

public record ProcessDefinitionResponse(
    String id,
    String name,
    String description,
    String icon,
    String status,
    String businessType,
    String activeVersionId,
    String formSchema,
    String flowSchema,
    OffsetDateTime publishedAt,
    OffsetDateTime updatedAt) {

  // 兼容既有 API 调用；新版响应会带业务类型与已发布版本信息。
  public ProcessDefinitionResponse(
      String id,
      String name,
      String description,
      String icon,
      String status,
      String formSchema,
      String flowSchema,
      OffsetDateTime updatedAt) {
    this(id, name, description, icon, status, null, null, formSchema, flowSchema, null, updatedAt);
  }
}
