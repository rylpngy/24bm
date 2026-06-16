package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.identity.domain.BuyerUserStatus;
import com.procurement.identity.domain.BuyerUserStatusTransition;
import org.junit.jupiter.api.Test;

class BuyerUserStatusTransitionTests {

  private final BuyerUserStatusTransition transition = new BuyerUserStatusTransition();

  @Test
  void supportsOnlyActiveAndInactiveTargets() {
    assertThatCode(() -> transition.requireSupportedTarget(BuyerUserStatus.ACTIVE))
        .doesNotThrowAnyException();
    assertThatCode(() -> transition.requireSupportedTarget(BuyerUserStatus.INACTIVE))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireSupportedTarget("archived"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported buyer user status: archived");
  }
}
