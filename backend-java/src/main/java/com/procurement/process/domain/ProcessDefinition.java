package com.procurement.process.domain;

import java.time.OffsetDateTime;

// 流程定义:可视化配置的审批流程。formSchema/flowSchema 为前端拥有的 JSON 文本。
public record ProcessDefinition(
    String id,
    String tenantId,
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

  /**
   * Compatibility constructor for historical process-instance tests and imports.
   * New production definitions must declare a business type and are published as immutable versions.
   */
  public ProcessDefinition(
      String id,
      String tenantId,
      String name,
      String description,
      String icon,
      String status,
      String formSchema,
      String flowSchema,
      OffsetDateTime updatedAt) {
    this(id, tenantId, name, description, icon, status, null, null, formSchema, flowSchema, null, updatedAt);
  }
}
