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

  // 通用审批任务(无模板,如流程引擎实例):直接建 pending 任务,进 审批中心 统一收件箱。
  public ApprovalTask createGenericPendingTask(
      String tenantId, String bizType, String bizId, String assigneeId) {
    String approvalTaskId = "approval-" + UUID.randomUUID();
    approvalTaskMapper.insert(approvalTaskId, tenantId, bizType, bizId, assigneeId, ApprovalStatus.PENDING);
    return approvalTaskMapper.findByTenantAndId(tenantId, approvalTaskId);
  }

  // 取某业务对象当前待审批任务(无则 null)。
  public ApprovalTask findPendingTask(String tenantId, String bizType, String bizId) {
    return approvalTaskMapper.findPendingByBiz(tenantId, bizType, bizId, ApprovalStatus.PENDING);
  }

  public ApprovalTask recordDecision(String tenantId, String taskId, String newStatus, String actorId, String comment) {
    if (!ApprovalStatus.APPROVED.equals(newStatus) && !ApprovalStatus.REJECTED.equals(newStatus)) {
      throw new IllegalArgumentException("Unsupported approval decision: " + newStatus);
    }
    int updated = approvalTaskMapper.updateStatus(
        tenantId, taskId, ApprovalStatus.PENDING, newStatus, actorId, comment);
    if (updated == 0) {
      throw new IllegalStateException("Approval task status changed before review could be recorded: " + taskId);
    }
    return approvalTaskMapper.findByTenantAndId(tenantId, taskId);
  }

  // 完成审批任务(通过/驳回),写审批意见。
  public void completeTask(String tenantId, String taskId, String newStatus, String comment) {
    ApprovalTask task = approvalTaskMapper.findByTenantAndId(tenantId, taskId);
    if (task == null) {
      throw new IllegalArgumentException("Approval task not found: " + taskId);
    }
    approvalTaskMapper.updateStatus(
        tenantId, taskId, ApprovalStatus.PENDING, newStatus, task.assigneeId(), comment);
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
