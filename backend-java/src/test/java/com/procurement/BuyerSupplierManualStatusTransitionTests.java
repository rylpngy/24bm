package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.supplier.domain.BuyerSupplierManualStatusTransition;
import com.procurement.supplier.domain.BuyerSupplierRelationStatus;
import org.junit.jupiter.api.Test;

class BuyerSupplierManualStatusTransitionTests {

  private final BuyerSupplierManualStatusTransition transition = new BuyerSupplierManualStatusTransition();

  @Test
  void supportsOnlyBlacklistAndPendingAdmissionManualTargets() {
    assertThatCode(() -> transition.requireSupportedTarget(BuyerSupplierRelationStatus.BLACKLISTED))
        .doesNotThrowAnyException();
    assertThatCode(() -> transition.requireSupportedTarget(BuyerSupplierRelationStatus.PENDING_ADMISSION))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireSupportedTarget(BuyerSupplierRelationStatus.ADMITTED))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported buyer supplier relation target status: 已准入");
  }

  @Test
  void rejectsManualChangesWhileAdmissionApprovalIsInProgress() {
    assertThatThrownBy(() -> transition.requireTransition(
            BuyerSupplierRelationStatus.IN_ADMISSION_APPROVAL,
            BuyerSupplierRelationStatus.BLACKLISTED,
            "rel-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Supplier relations in admission approval cannot be manually changed: rel-1");
  }

  @Test
  void restoresOnlyBlacklistedOrRejectedRelationsToPendingAdmission() {
    assertThatCode(() -> transition.requireTransition(
            BuyerSupplierRelationStatus.BLACKLISTED,
            BuyerSupplierRelationStatus.PENDING_ADMISSION,
            "rel-1"))
        .doesNotThrowAnyException();
    assertThatCode(() -> transition.requireTransition(
            BuyerSupplierRelationStatus.REJECTED,
            BuyerSupplierRelationStatus.PENDING_ADMISSION,
            "rel-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireTransition(
            BuyerSupplierRelationStatus.ADMITTED,
            BuyerSupplierRelationStatus.PENDING_ADMISSION,
            "rel-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining(
            "Only blacklisted or rejected supplier relations can be restored to pending admission: rel-1");
  }

  @Test
  void allowsBlacklistFromOtherNonApprovalStates() {
    assertThatCode(() -> transition.requireTransition(
            BuyerSupplierRelationStatus.ADMITTED,
            BuyerSupplierRelationStatus.BLACKLISTED,
            "rel-1"))
        .doesNotThrowAnyException();
    assertThatCode(() -> transition.requireTransition(
            BuyerSupplierRelationStatus.PENDING_ADMISSION,
            BuyerSupplierRelationStatus.BLACKLISTED,
            "rel-1"))
        .doesNotThrowAnyException();
    assertThatCode(() -> transition.requireTransition(
            BuyerSupplierRelationStatus.REJECTED,
            BuyerSupplierRelationStatus.BLACKLISTED,
            "rel-1"))
        .doesNotThrowAnyException();
  }
}
