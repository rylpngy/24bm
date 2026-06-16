package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.supplier.domain.SupplierQualificationStatus;
import com.procurement.supplier.domain.SupplierQualificationStatusTransition;
import org.junit.jupiter.api.Test;

class SupplierQualificationStatusTransitionTests {

  private final SupplierQualificationStatusTransition transition =
      new SupplierQualificationStatusTransition();

  @Test
  void supportsOnlyActiveAndInactiveTargets() {
    assertThatCode(() -> transition.requireSupportedTarget(SupplierQualificationStatus.ACTIVE))
        .doesNotThrowAnyException();
    assertThatCode(() -> transition.requireSupportedTarget(SupplierQualificationStatus.INACTIVE))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireSupportedTarget("expired"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported supplier qualification status: expired");
  }
}
