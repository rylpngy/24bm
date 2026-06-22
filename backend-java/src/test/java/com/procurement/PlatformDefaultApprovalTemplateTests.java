package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.platform.domain.PlatformDefaultApprovalTemplate;
import org.junit.jupiter.api.Test;

class PlatformDefaultApprovalTemplateTests {
  @Test
  void definesInitialBuyerApprovalTemplatesForTenantOnboarding() {
    assertThat(PlatformDefaultApprovalTemplate.BUYER_TEMPLATES)
        .extracting(
            PlatformDefaultApprovalTemplate::code,
            PlatformDefaultApprovalTemplate::businessType,
            PlatformDefaultApprovalTemplate::name,
            PlatformDefaultApprovalTemplate::sortOrder)
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple(
                "TPL_PURCHASE_DEMAND",
                ApprovalBusinessType.PURCHASE_DEMAND,
                "需求审批",
                10),
            org.assertj.core.groups.Tuple.tuple(
                "TPL_SUPPLIER_ADMISSION",
                ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION,
                "供应商准入",
                20),
            org.assertj.core.groups.Tuple.tuple(
                "TPL_RFQ_AWARD",
                ApprovalBusinessType.RFQ_AWARD,
                "定标审批",
                30),
            org.assertj.core.groups.Tuple.tuple(
                "TPL_CONTRACT_APPROVAL",
                ApprovalBusinessType.CONTRACT_APPROVAL,
                "合同审批",
                40),
            org.assertj.core.groups.Tuple.tuple(
                "TPL_PAYMENT_BATCH",
                ApprovalBusinessType.PAYMENT_BATCH,
                "付款批次审批",
                60),
            org.assertj.core.groups.Tuple.tuple(
                "TPL_PAYMENT_ARCHIVE_EXCEPTION",
                ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION,
                "付款归档异常审批",
                70));
  }
}
