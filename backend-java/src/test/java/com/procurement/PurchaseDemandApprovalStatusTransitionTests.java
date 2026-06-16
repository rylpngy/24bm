package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.demand.domain.PurchaseDemandApprovalStatusTransition;
import com.procurement.demand.domain.PurchaseDemandStatus;
import org.junit.jupiter.api.Test;

class PurchaseDemandApprovalStatusTransitionTests {

  private final PurchaseDemandApprovalStatusTransition transition =
      new PurchaseDemandApprovalStatusTransition();

  @Test
  void allowsSubmissionOnlyFromDraftDemand() {
    assertThatCode(() -> transition.requireSubmission(PurchaseDemandStatus.DRAFT, "demand-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireSubmission(PurchaseDemandStatus.IN_APPROVAL, "demand-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only draft purchase demands can be submitted: demand-1");
  }

  @Test
  void allowsReviewOnlyFromInApprovalDemand() {
    assertThatCode(() -> transition.requireReview(PurchaseDemandStatus.IN_APPROVAL, "demand-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireReview(PurchaseDemandStatus.DRAFT, "demand-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only in-approval purchase demands can be reviewed: demand-1");
  }

  @Test
  void resolvesDemandTargetStatusFromApprovalResult() {
    assertThat(transition.reviewTargetStatus(true)).isEqualTo(PurchaseDemandStatus.APPROVED);
    assertThat(transition.reviewTargetStatus(false)).isEqualTo(PurchaseDemandStatus.REJECTED);
  }
}
