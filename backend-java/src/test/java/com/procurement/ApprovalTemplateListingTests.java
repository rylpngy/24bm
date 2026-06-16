package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.api.UpdateApprovalTemplateRequest;
import com.procurement.approval.domain.ApprovalTemplate;
import com.procurement.approval.domain.ApprovalTemplateStatusTransition;
import com.procurement.approval.application.ApprovalTemplateApplicationService;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ApprovalTemplateListingTests {

  private final ApprovalTemplateMapper approvalTemplateMapper = org.mockito.Mockito.mock(ApprovalTemplateMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final ApprovalTemplateApplicationService approvalTemplateApplicationService =
      new ApprovalTemplateApplicationService(
          approvalTemplateMapper,
          auditLogApplicationService,
          new ApprovalTemplateStatusTransition());

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listTemplatesReadsCurrentTenantTemplatesInStableOrder() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(approvalTemplateMapper.listByTenant("tenant-1")).thenReturn(List.of(
        new ApprovalTemplate(
            "TPL_PURCHASE_DEMAND",
            "tenant-1",
            "purchase_demand",
            "需求审批",
            "role-buyer-owner",
            "active"),
        new ApprovalTemplate(
            "TPL_SUPPLIER_ADMISSION",
            "tenant-1",
            "buyer_supplier_admission",
            "供应商准入",
            "role-buyer-owner",
            "inactive"),
        new ApprovalTemplate(
            "TPL_RFQ_AWARD",
            "tenant-1",
            "rfq_award",
            "定标审批",
            "role-buyer-owner",
            "active")));

    var templates = approvalTemplateApplicationService.listTemplates();

    assertThat(templates).extracting("templateCode")
        .containsExactly("TPL_PURCHASE_DEMAND", "TPL_SUPPLIER_ADMISSION", "TPL_RFQ_AWARD");
    assertThat(templates).extracting("bizType")
        .containsExactly("purchase_demand", "buyer_supplier_admission", "rfq_award");
    assertThat(templates).extracting("status").containsExactly("active", "inactive", "active");
    assertThat(templates).allSatisfy(template ->
        assertThat(template.defaultApproverRoleId()).isEqualTo("role-buyer-owner"));
    verify(approvalTemplateMapper).listByTenant("tenant-1");
  }

  @Test
  void updateTemplateRejectsRoleOutsideCurrentTenantBeforeWritingTemplate() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(approvalTemplateMapper.existsBuyerRoleByTenantAndId("tenant-1", "role-other"))
        .thenReturn(false);

    assertThatThrownBy(() -> approvalTemplateApplicationService.updateTemplate(
        "TPL_PURCHASE_DEMAND",
        new UpdateApprovalTemplateRequest("role-other", "active")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Buyer role not found in tenant scope: role-other");

    verify(approvalTemplateMapper, never()).updateTemplateConfig(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void updateTemplateRejectsUnsupportedStatusBeforeWritingTemplate() {
    TenantContext.set("tenant-1", null, "buyer-owner");

    assertThatThrownBy(() -> approvalTemplateApplicationService.updateTemplate(
        "TPL_PURCHASE_DEMAND",
        new UpdateApprovalTemplateRequest("role-buyer-owner", "archived")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported approval template status: archived");

    verify(approvalTemplateMapper, never()).updateTemplateConfig(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void updateTemplatePersistsCurrentTenantConfigAndReturnsUpdatedTemplate() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(approvalTemplateMapper.existsBuyerRoleByTenantAndId("tenant-1", "role-buyer-finance"))
        .thenReturn(true);
    when(approvalTemplateMapper.updateTemplateConfig(
        "tenant-1",
        "TPL_PURCHASE_DEMAND",
        "role-buyer-finance",
        "inactive")).thenReturn(1);
    when(approvalTemplateMapper.findByTenantAndCode("tenant-1", "TPL_PURCHASE_DEMAND"))
        .thenReturn(new ApprovalTemplate(
            "TPL_PURCHASE_DEMAND",
            "tenant-1",
            "purchase_demand",
            "需求审批",
            "role-buyer-finance",
            "inactive"));

    var response = approvalTemplateApplicationService.updateTemplate(
        "TPL_PURCHASE_DEMAND",
        new UpdateApprovalTemplateRequest("role-buyer-finance", "inactive"));

    assertThat(response.defaultApproverRoleId()).isEqualTo("role-buyer-finance");
    assertThat(response.status()).isEqualTo("inactive");
    verify(approvalTemplateMapper).updateTemplateConfig(
        "tenant-1",
        "TPL_PURCHASE_DEMAND",
        "role-buyer-finance",
        "inactive");
    verify(auditLogApplicationService).recordTenantAction(
        "approval_template.config_updated",
        "approval_template",
        "TPL_PURCHASE_DEMAND");
  }
}
