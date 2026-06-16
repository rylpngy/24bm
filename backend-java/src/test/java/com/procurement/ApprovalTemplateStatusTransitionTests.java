package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.approval.domain.ApprovalTemplateStatus;
import com.procurement.approval.domain.ApprovalTemplateStatusTransition;
import org.junit.jupiter.api.Test;

class ApprovalTemplateStatusTransitionTests {

  private final ApprovalTemplateStatusTransition transition = new ApprovalTemplateStatusTransition();

  @Test
  void supportsOnlyActiveAndInactiveTargets() {
    assertThatCode(() -> transition.requireSupportedTarget(ApprovalTemplateStatus.ACTIVE))
        .doesNotThrowAnyException();
    assertThatCode(() -> transition.requireSupportedTarget(ApprovalTemplateStatus.INACTIVE))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireSupportedTarget("archived"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported approval template status: archived");
  }
}
