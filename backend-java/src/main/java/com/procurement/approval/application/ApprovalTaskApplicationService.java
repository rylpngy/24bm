package com.procurement.approval.application;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ApprovalTaskApplicationService {
  public static final String PENDING_APPROVAL_STATUS = "待审批";
  private static final String DEFAULT_BUYER_APPROVER_ROLE_ID = "role-buyer-owner";

  private final ApprovalTaskMapper approvalTaskMapper;
  private final BuyerUserMapper buyerUserMapper;

  public ApprovalTaskApplicationService(
      ApprovalTaskMapper approvalTaskMapper,
      BuyerUserMapper buyerUserMapper) {
    this.approvalTaskMapper = approvalTaskMapper;
    this.buyerUserMapper = buyerUserMapper;
  }

  public ApprovalTask createPendingTask(
      String tenantId,
      String bizType,
      String bizId,
      String assigneeId) {
    ApprovalTemplate template = resolveTemplate(bizType);
    String resolvedAssigneeId = assigneeId == null || assigneeId.isBlank()
        ? resolveDefaultAssigneeId(tenantId, template)
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
          DEFAULT_BUYER_APPROVER_ROLE_ID);
      case "buyer_supplier_admission" -> new ApprovalTemplate(
          "TPL_SUPPLIER_ADMISSION",
          bizType,
          DEFAULT_BUYER_APPROVER_ROLE_ID);
      case "rfq_award" -> new ApprovalTemplate(
          "TPL_RFQ_AWARD",
          bizType,
          DEFAULT_BUYER_APPROVER_ROLE_ID);
      default -> throw new IllegalArgumentException("Unsupported approval biz type: " + bizType);
    };
  }

  private String resolveDefaultAssigneeId(String tenantId, ApprovalTemplate template) {
    String assigneeId = buyerUserMapper.findDefaultApproverId(tenantId, template.defaultApproverRoleId());
    if (assigneeId == null || assigneeId.isBlank()) {
      throw new IllegalStateException(
          "Default approver not found for template: " + template.templateCode());
    }
    return assigneeId;
  }

  public record ApprovalTemplate(
      String templateCode,
      String bizType,
      String defaultApproverRoleId) {
  }
}
