package com.procurement.process.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;

// 解析出的审批路径节点(approver=需审批 / auto=系统自动通过)。
public record ResolvedStep(String type, String title, String assignee) {
  // 派生属性不参与序列化:否则 resolvedPath 会写入 "approver" 字段,回读时按未知属性失败。
  @JsonIgnore
  public boolean isApprover() {
    return "approver".equals(type);
  }
}
