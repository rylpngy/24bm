package com.procurement;

import com.procurement.approval.application.ApprovalGate;

// 测试用审批闸门:恒定「需要审批」,保持既有审批流测试语义不变。
public final class TestApprovalGates {
  private TestApprovalGates() {}

  public static ApprovalGate alwaysOn() {
    return new ApprovalGate(null) {
      @Override
      public boolean requiresApproval(String tenantId, String bizType) {
        return true;
      }
    };
  }

  public static ApprovalGate alwaysOff() {
    return new ApprovalGate(null) {
      @Override
      public boolean requiresApproval(String tenantId, String bizType) {
        return false;
      }
    };
  }
}
