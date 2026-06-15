package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.approval.application.ApprovalTemplateApplicationService;
import org.junit.jupiter.api.Test;

class ApprovalTemplateListingTests {

  private final ApprovalTemplateApplicationService approvalTemplateApplicationService =
      new ApprovalTemplateApplicationService();

  @Test
  void listFixedTemplatesReturnsMvpApprovalTypesInStableOrder() {
    var templates = approvalTemplateApplicationService.listTemplates();

    assertThat(templates).extracting("templateCode")
        .containsExactly("TPL_PURCHASE_DEMAND", "TPL_SUPPLIER_ADMISSION", "TPL_RFQ_AWARD");
    assertThat(templates).extracting("bizType")
        .containsExactly("purchase_demand", "buyer_supplier_admission", "rfq_award");
    assertThat(templates).allSatisfy(template -> {
      assertThat(template.defaultApproverRoleId()).isEqualTo("role-buyer-owner");
      assertThat(template.status()).isEqualTo("active");
    });
  }
}
