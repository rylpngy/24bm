package com.procurement.approval.domain;

public final class ApprovalStatus {
  public static final String PENDING = "待审批";
  public static final String APPROVED = "已通过";
  public static final String REJECTED = "已驳回";

  private ApprovalStatus() {
  }
}
