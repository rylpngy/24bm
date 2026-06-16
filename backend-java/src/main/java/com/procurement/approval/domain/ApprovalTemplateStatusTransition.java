package com.procurement.approval.domain;

import org.springframework.stereotype.Component;

@Component
public class ApprovalTemplateStatusTransition {

  public void requireSupportedTarget(String status) {
    if (!ApprovalTemplateStatus.ACTIVE.equals(status) && !ApprovalTemplateStatus.INACTIVE.equals(status)) {
      throw new IllegalArgumentException("Unsupported approval template status: " + status);
    }
  }
}
