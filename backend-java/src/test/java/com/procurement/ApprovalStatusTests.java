package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.approval.domain.ApprovalStatus;
import org.junit.jupiter.api.Test;

class ApprovalStatusTests {

  @Test
  void definesPendingApprovedAndRejectedApprovalStatuses() {
    assertThat(ApprovalStatus.PENDING).isEqualTo("待审批");
    assertThat(ApprovalStatus.APPROVED).isEqualTo("已通过");
    assertThat(ApprovalStatus.REJECTED).isEqualTo("已驳回");
  }
}
