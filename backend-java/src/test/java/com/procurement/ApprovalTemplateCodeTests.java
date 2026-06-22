package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.approval.domain.ApprovalTemplateCode;
import org.junit.jupiter.api.Test;

class ApprovalTemplateCodeTests {
  @Test
  void resolvesTemplateCodeByApprovalBusinessType() {
    assertThat(ApprovalTemplateCode.PURCHASE_DEMAND).isEqualTo("TPL_PURCHASE_DEMAND");
    assertThat(ApprovalTemplateCode.SUPPLIER_ADMISSION).isEqualTo("TPL_SUPPLIER_ADMISSION");
    assertThat(ApprovalTemplateCode.RFQ_AWARD).isEqualTo("TPL_RFQ_AWARD");
    assertThat(ApprovalTemplateCode.PAYMENT_REQUEST).isEqualTo("TPL_PAYMENT_REQUEST");
    assertThat(ApprovalTemplateCode.PAYMENT_BATCH).isEqualTo("TPL_PAYMENT_BATCH");
    assertThat(ApprovalTemplateCode.PAYMENT_ARCHIVE_EXCEPTION)
        .isEqualTo("TPL_PAYMENT_ARCHIVE_EXCEPTION");

    assertThat(ApprovalTemplateCode.requireByBusinessType(ApprovalBusinessType.PURCHASE_DEMAND))
        .isEqualTo(ApprovalTemplateCode.PURCHASE_DEMAND);
    assertThat(ApprovalTemplateCode.requireByBusinessType(ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION))
        .isEqualTo(ApprovalTemplateCode.SUPPLIER_ADMISSION);
    assertThat(ApprovalTemplateCode.requireByBusinessType(ApprovalBusinessType.RFQ_AWARD))
        .isEqualTo(ApprovalTemplateCode.RFQ_AWARD);
    assertThat(ApprovalTemplateCode.requireByBusinessType(ApprovalBusinessType.PAYMENT_REQUEST))
        .isEqualTo(ApprovalTemplateCode.PAYMENT_REQUEST);
    assertThat(ApprovalTemplateCode.requireByBusinessType(ApprovalBusinessType.PAYMENT_BATCH))
        .isEqualTo(ApprovalTemplateCode.PAYMENT_BATCH);
    assertThat(ApprovalTemplateCode.requireByBusinessType(ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION))
        .isEqualTo(ApprovalTemplateCode.PAYMENT_ARCHIVE_EXCEPTION);
  }

  @Test
  void rejectsUnsupportedApprovalBusinessType() {
    assertThatThrownBy(() -> ApprovalTemplateCode.requireByBusinessType("unknown_biz"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported approval biz type");
  }
}
