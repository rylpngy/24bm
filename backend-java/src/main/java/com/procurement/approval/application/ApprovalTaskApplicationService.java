package com.procurement.approval.application;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ApprovalTaskApplicationService {
  public static final String PENDING_APPROVAL_STATUS = "待审批";

  private final ApprovalTaskMapper approvalTaskMapper;

  public ApprovalTaskApplicationService(ApprovalTaskMapper approvalTaskMapper) {
    this.approvalTaskMapper = approvalTaskMapper;
  }

  public ApprovalTask createPendingTask(
      String tenantId,
      String bizType,
      String bizId,
      String assigneeId) {
    String approvalTaskId = "approval-" + UUID.randomUUID();
    approvalTaskMapper.insert(
        approvalTaskId,
        tenantId,
        bizType,
        bizId,
        assigneeId,
        PENDING_APPROVAL_STATUS);
    return approvalTaskMapper.findByTenantAndId(tenantId, approvalTaskId);
  }
}
