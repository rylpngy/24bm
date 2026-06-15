package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.domain.ApprovalTemplate;
import com.procurement.approval.application.ApprovalTemplateApplicationService;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.common.tenant.TenantContext;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ApprovalTemplateListingTests {

  private final ApprovalTemplateMapper approvalTemplateMapper = org.mockito.Mockito.mock(ApprovalTemplateMapper.class);
  private final ApprovalTemplateApplicationService approvalTemplateApplicationService =
      new ApprovalTemplateApplicationService(approvalTemplateMapper);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listTemplatesReadsCurrentTenantActiveTemplatesInStableOrder() {
    TenantContext.set("tenant-1", null, "buyer-owner");
    when(approvalTemplateMapper.listActiveByTenant("tenant-1")).thenReturn(List.of(
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
            "active"),
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
    assertThat(templates).allSatisfy(template -> {
      assertThat(template.defaultApproverRoleId()).isEqualTo("role-buyer-owner");
      assertThat(template.status()).isEqualTo("active");
    });
    verify(approvalTemplateMapper).listActiveByTenant("tenant-1");
  }
}
