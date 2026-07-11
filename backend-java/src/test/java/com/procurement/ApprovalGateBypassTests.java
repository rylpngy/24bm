package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.application.ApprovalGate;
import com.procurement.approval.application.ApprovalTemplateApplicationService;
import com.procurement.approval.domain.ApprovalTemplateStatusTransition;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 审批闸门:节点关闭 = 免审直通(业务自动推进+留痕),而非报错;财务合规节点不可关闭。
class ApprovalGateBypassTests {

  private final ApprovalTemplateMapper templateMapper = mock(ApprovalTemplateMapper.class);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void gateReflectsActiveTemplatePresence() {
    ApprovalGate gate = new ApprovalGate(templateMapper);
    when(templateMapper.findActiveByTenantAndBizType("tenant-1", "purchase_demand"))
        .thenReturn(null);
    assertThat(gate.requiresApproval("tenant-1", "purchase_demand")).isFalse();
  }

  @Test
  void financeComplianceTemplatesCannotBeDisabled() {
    TenantContext.set("tenant-1", null, "buyer-user");
    ApprovalTemplateApplicationService service = new ApprovalTemplateApplicationService(
        templateMapper, mock(AuditLogApplicationService.class), new ApprovalTemplateStatusTransition());
    when(templateMapper.existsBuyerRoleByTenantAndId(anyString(), anyString())).thenReturn(true);

    org.assertj.core.api.Assertions.assertThatThrownBy(() ->
        service.updateTemplate("TPL_PAYMENT_BATCH",
            new com.procurement.approval.api.UpdateApprovalTemplateRequest("role-1", "inactive")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("不可关闭");
  }
}
