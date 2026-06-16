package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.sourcing.domain.RfqAwardAuditAction;
import org.junit.jupiter.api.Test;

class RfqAwardAuditActionTests {

  @Test
  void definesRfqAwardAuditActions() {
    assertThat(RfqAwardAuditAction.SUBMITTED).isEqualTo("rfq_award.submitted");
    assertThat(RfqAwardAuditAction.APPROVED).isEqualTo("rfq_award.approved");
    assertThat(RfqAwardAuditAction.REJECTED).isEqualTo("rfq_award.rejected");
  }
}
