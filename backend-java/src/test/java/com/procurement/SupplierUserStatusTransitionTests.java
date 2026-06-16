package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.supplier.domain.SupplierUserStatus;
import com.procurement.supplier.domain.SupplierUserStatusTransition;
import org.junit.jupiter.api.Test;

class SupplierUserStatusTransitionTests {

  private final SupplierUserStatusTransition transition = new SupplierUserStatusTransition();

  @Test
  void supportsOnlyActiveAndInactiveTargets() {
    assertThatCode(() -> transition.requireSupportedTarget(SupplierUserStatus.ACTIVE))
        .doesNotThrowAnyException();
    assertThatCode(() -> transition.requireSupportedTarget(SupplierUserStatus.INACTIVE))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireSupportedTarget("locked"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported supplier user status: locked");
  }
}
