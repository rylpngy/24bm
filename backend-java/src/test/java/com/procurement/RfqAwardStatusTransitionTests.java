package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.sourcing.domain.RfqAwardStatusTransition;
import com.procurement.sourcing.domain.RfqStatus;
import org.junit.jupiter.api.Test;

class RfqAwardStatusTransitionTests {

  private final RfqAwardStatusTransition transition = new RfqAwardStatusTransition();

  @Test
  void allowsAwardSubmissionOnlyFromQuotingRfq() {
    assertThatCode(() -> transition.requireAwardSubmission(RfqStatus.QUOTING, "rfq-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireAwardSubmission(RfqStatus.AWARDED, "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only quoting RFQs can be awarded: rfq-1");
  }

  @Test
  void allowsAwardReviewOnlyFromAwardApprovalRfq() {
    assertThatCode(() -> transition.requireAwardReview(RfqStatus.AWARD_APPROVAL, "rfq-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireAwardReview(RfqStatus.QUOTING, "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only RFQs in award approval can be reviewed: rfq-1");
  }

  @Test
  void resolvesTargetStatusFromApprovalResult() {
    assertThat(transition.reviewTargetStatus(true)).isEqualTo(RfqStatus.AWARDED);
    assertThat(transition.reviewTargetStatus(false)).isEqualTo(RfqStatus.QUOTING);
  }
}
