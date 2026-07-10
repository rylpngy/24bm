package com.procurement.organization.domain;

import java.time.LocalDate;

public record Department(
    String id,
    String tenantId,
    String name,
    String parentId,
    String status,
    String description,
    String managerId,
    String managerName,
    int memberCount,
    LocalDate establishedOn) {

  // 兼容旧调用(无组织架构扩展字段)。
  public Department(String id, String tenantId, String name, String parentId, String status) {
    this(id, tenantId, name, parentId, status, "", null, null, 0, null);
  }
}
