package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.sourcing.domain.RfqQuoteSubmissionPolicy;
import org.junit.jupiter.api.Test;

class RfqQuoteSubmissionPolicyTests {
  @Test
  void allowsFirstSubmittedQuoteFromSupplier() {
    assertThatCode(() -> RfqQuoteSubmissionPolicy.requireNoSubmittedQuote(0, "rfq-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void rejectsDuplicateSubmittedQuoteFromSupplier() {
    assertThatThrownBy(() -> RfqQuoteSubmissionPolicy.requireNoSubmittedQuote(1, "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Supplier has already submitted a quote: rfq-1");
  }
}
