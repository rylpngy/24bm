package com.procurement.approval.application;

import com.procurement.approval.api.ApprovalTemplateResponse;
import com.procurement.approval.domain.ApprovalTemplate;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ApprovalTemplateApplicationService {
  private final ApprovalTemplateMapper approvalTemplateMapper;

  public ApprovalTemplateApplicationService(ApprovalTemplateMapper approvalTemplateMapper) {
    this.approvalTemplateMapper = approvalTemplateMapper;
  }

  public List<ApprovalTemplateResponse> listTemplates() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer approval template APIs");
    return approvalTemplateMapper.listActiveByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
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
