package com.procurement.approval.application;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ApprovalTaskApplicationService {
  public static final String PENDING_APPROVAL_STATUS = "待审批";
  private static final String DEFAULT_BUYER_APPROVER_ID = "buyer-owner";

  private final ApprovalTaskMapper approvalTaskMapper;

  public ApprovalTaskApplicationService(ApprovalTaskMapper approvalTaskMapper) {
    this.approvalTaskMapper = approvalTaskMapper;
  }

  public ApprovalTask createPendingTask(
      String tenantId,
      String bizType,
      String bizId,
      String assigneeId) {
    ApprovalTemplate template = resolveTemplate(bizType);
    String resolvedAssigneeId = assigneeId == null || assigneeId.isBlank()
        ? template.defaultAssigneeId()
        : assigneeId;
    String approvalTaskId = "approval-" + UUID.randomUUID();
    approvalTaskMapper.insert(
        approvalTaskId,
        tenantId,
        bizType,
        bizId,
        resolvedAssigneeId,
        PENDING_APPROVAL_STATUS);
    return approvalTaskMapper.findByTenantAndId(tenantId, approvalTaskId);
  }

  public ApprovalTemplate resolveTemplate(String bizType) {
    return switch (bizType) {
      case "purchase_demand" -> new ApprovalTemplate(
          "TPL_PURCHASE_DEMAND",
          bizType,
          DEFAULT_BUYER_APPROVER_ID);
      case "buyer_supplier_admission" -> new ApprovalTemplate(
          "TPL_SUPPLIER_ADMISSION",
          bizType,
          DEFAULT_BUYER_APPROVER_ID);
      case "rfq_award" -> new ApprovalTemplate(
          "TPL_RFQ_AWARD",
          bizType,
          DEFAULT_BUYER_APPROVER_ID);
      default -> throw new IllegalArgumentException("Unsupported approval biz type: " + bizType);
    };
  }

  public record ApprovalTemplate(
      String templateCode,
      String bizType,
      String defaultAssigneeId) {
  }
}
