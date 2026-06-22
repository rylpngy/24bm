package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.approval.domain.ApprovalBusinessType;
import org.junit.jupiter.api.Test;

class ApprovalBusinessTypeTests {
  @Test
  void definesApprovalBusinessTypes() {
    assertThat(ApprovalBusinessType.PURCHASE_DEMAND).isEqualTo("purchase_demand");
    assertThat(ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION)
        .isEqualTo("buyer_supplier_admission");
    assertThat(ApprovalBusinessType.RFQ_AWARD).isEqualTo("rfq_award");
    assertThat(ApprovalBusinessType.PAYMENT_REQUEST).isEqualTo("payment_request");
    assertThat(ApprovalBusinessType.PAYMENT_BATCH).isEqualTo("payment_batch");
    assertThat(ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION)
        .isEqualTo("payment_archive_exception");
  }
}
