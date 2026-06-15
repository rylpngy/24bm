package com.procurement.approval.application;

import com.procurement.approval.api.ApprovalTemplateResponse;
import com.procurement.approval.api.UpdateApprovalTemplateRequest;
import com.procurement.approval.domain.ApprovalTemplate;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApprovalTemplateApplicationService {
  private static final String ACTIVE_STATUS = "active";
  private static final String INACTIVE_STATUS = "inactive";

  private final ApprovalTemplateMapper approvalTemplateMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public ApprovalTemplateApplicationService(
      ApprovalTemplateMapper approvalTemplateMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.approvalTemplateMapper = approvalTemplateMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  public List<ApprovalTemplateResponse> listTemplates() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer approval template APIs");
    return approvalTemplateMapper.listByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public ApprovalTemplateResponse updateTemplate(String templateCode, UpdateApprovalTemplateRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer approval template APIs");
    requireSupportedStatus(request.status());
    requireBuyerRole(tenantId, request.defaultApproverRoleId());
    int updated = approvalTemplateMapper.updateTemplateConfig(
        tenantId,
        templateCode,
        request.defaultApproverRoleId(),
        request.status());
    if (updated == 0) {
      throw new IllegalArgumentException("Approval template not found in tenant scope: " + templateCode);
    }
    auditLogApplicationService.recordTenantAction(
        "approval_template.config_updated",
        "approval_template",
        templateCode);
    return toResponse(approvalTemplateMapper.findByTenantAndCode(tenantId, templateCode));
  }

  private void requireBuyerRole(String tenantId, String roleId) {
    if (!approvalTemplateMapper.existsBuyerRoleByTenantAndId(tenantId, roleId)) {
      throw new IllegalArgumentException("Buyer role not found in tenant scope: " + roleId);
    }
  }

  private void requireSupportedStatus(String status) {
    if (!ACTIVE_STATUS.equals(status) && !INACTIVE_STATUS.equals(status)) {
      throw new IllegalArgumentException("Unsupported approval template status: " + status);
    }
  }

  private ApprovalTemplateResponse toResponse(ApprovalTemplate template) {
    return new ApprovalTemplateResponse(
        template.templateCode(),
        template.bizType(),
        template.name(),
        template.defaultApproverRoleId(),
        template.status());
  }
}
