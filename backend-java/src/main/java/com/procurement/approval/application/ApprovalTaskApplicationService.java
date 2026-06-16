package com.procurement.approval.application;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.approval.domain.ApprovalTemplate;
import com.procurement.approval.domain.ApprovalTemplateCode;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ApprovalTaskApplicationService {
  private final ApprovalTaskMapper approvalTaskMapper;
  private final ApprovalTemplateMapper approvalTemplateMapper;
  private final BuyerUserMapper buyerUserMapper;

  public ApprovalTaskApplicationService(
      ApprovalTaskMapper approvalTaskMapper,
      ApprovalTemplateMapper approvalTemplateMapper,
      BuyerUserMapper buyerUserMapper) {
    this.approvalTaskMapper = approvalTaskMapper;
    this.approvalTemplateMapper = approvalTemplateMapper;
    this.buyerUserMapper = buyerUserMapper;
  }

  public ApprovalTask createPendingTask(
      String tenantId,
      String bizType,
      String bizId,
      String assigneeId) {
    ApprovalTemplate template = resolveTemplate(tenantId, bizType);
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
        ApprovalStatus.PENDING);
    return approvalTaskMapper.findByTenantAndId(tenantId, approvalTaskId);
  }

  public ApprovalTemplate resolveTemplate(String tenantId, String bizType) {
    String expectedTemplateCode = ApprovalTemplateCode.requireByBusinessType(bizType);
    ApprovalTemplate template = approvalTemplateMapper.findActiveByTenantAndBizType(tenantId, bizType);
    if (template == null) {
      throw new IllegalStateException("Active approval template not found: " + expectedTemplateCode);
    }
    return template;
  }

  private String resolveDefaultAssigneeId(String tenantId, ApprovalTemplate template) {
    String assigneeId = buyerUserMapper.findDefaultApproverId(tenantId, template.defaultApproverRoleId());
    if (assigneeId == null || assigneeId.isBlank()) {
      throw new IllegalStateException(
          "Default approver not found for template: " + template.templateCode());
    }
    return assigneeId;
  }
}
