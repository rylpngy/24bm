package com.procurement.workflow.domain;

public final class WorkflowInstanceStatus {
  public static final String PROCESSING = "processing";
  public static final String APPROVED = "approved";
  public static final String REJECTED = "rejected";
  public static final String CANCELLED = "cancelled";

  private WorkflowInstanceStatus() {
  }
}
