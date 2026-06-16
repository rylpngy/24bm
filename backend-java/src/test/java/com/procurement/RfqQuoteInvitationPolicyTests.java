package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.sourcing.domain.RfqQuoteInvitationPolicy;
import org.junit.jupiter.api.Test;

class RfqQuoteInvitationPolicyTests {
  @Test
  void allowsInvitedSupplierToQuote() {
    assertThatCode(() -> RfqQuoteInvitationPolicy.requireInvitedSupplier(1, "rfq-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void rejectsQuoteFromUninvitedSupplier() {
    assertThatThrownBy(() -> RfqQuoteInvitationPolicy.requireInvitedSupplier(0, "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Supplier is not invited to RFQ: rfq-1");
  }
}
