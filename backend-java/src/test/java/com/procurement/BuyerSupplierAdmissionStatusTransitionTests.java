package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.supplier.domain.BuyerSupplierAdmissionStatusTransition;
import com.procurement.supplier.domain.BuyerSupplierRelationStatus;
import org.junit.jupiter.api.Test;

class BuyerSupplierAdmissionStatusTransitionTests {

  private final BuyerSupplierAdmissionStatusTransition transition =
      new BuyerSupplierAdmissionStatusTransition();

  @Test
  void allowsAdmissionSubmissionOnlyFromPendingAdmission() {
    assertThatCode(() -> transition.requireAdmissionSubmission(
        BuyerSupplierRelationStatus.PENDING_ADMISSION,
        "rel-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireAdmissionSubmission(
        BuyerSupplierRelationStatus.ADMITTED,
        "rel-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only pending supplier relations can be submitted for admission: rel-1");
  }

  @Test
  void allowsAdmissionReviewOnlyFromInAdmissionApproval() {
    assertThatCode(() -> transition.requireAdmissionReview(
        BuyerSupplierRelationStatus.IN_ADMISSION_APPROVAL,
        "rel-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireAdmissionReview(
        BuyerSupplierRelationStatus.PENDING_ADMISSION,
        "rel-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only supplier relations in admission approval can be reviewed: rel-1");
  }

  @Test
  void resolvesRelationTargetStatusFromApprovalResult() {
    assertThat(transition.reviewTargetStatus(true)).isEqualTo(BuyerSupplierRelationStatus.ADMITTED);
    assertThat(transition.reviewTargetStatus(false)).isEqualTo(BuyerSupplierRelationStatus.REJECTED);
  }
}
