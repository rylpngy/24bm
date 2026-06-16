package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.sourcing.domain.RfqDemandLinkPolicy;
import org.junit.jupiter.api.Test;

class RfqDemandLinkPolicyTests {
  @Test
  void allowsUnlinkedPurchaseDemandForRfqCreation() {
    assertThatCode(() -> RfqDemandLinkPolicy.requireUnlinkedDemand(0, "demand-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void rejectsPurchaseDemandAlreadyLinkedToRfq() {
    assertThatThrownBy(() -> RfqDemandLinkPolicy.requireUnlinkedDemand(1, "demand-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Purchase demand already linked to an RFQ: demand-1");
  }
}
