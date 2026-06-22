package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.demand.domain.PurchaseDemandStatus;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.domain.RfqStatus;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

class RfqSourcingStatusTransitionTests {

  private final RfqSourcingStatusTransition transition = new RfqSourcingStatusTransition();

  @Test
  void allowsRfqCreationOnlyFromApprovedDemand() {
    assertThatCode(() -> transition.requireApprovedDemandForRfq(
        PurchaseDemandStatus.APPROVED,
        "demand-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireApprovedDemandForRfq(
        PurchaseDemandStatus.IN_APPROVAL,
        "demand-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("RFQ can only use approved purchase demands: demand-1");
  }

  @Test
  void allowsQuoteSubmissionOnlyWhenRfqIsQuoting() {
    assertThatCode(() -> transition.requireQuotingForQuoteSubmission(
        RfqStatus.QUOTING,
        "rfq-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireQuotingForQuoteSubmission(
        RfqStatus.AWARD_APPROVAL,
        "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("RFQ is not open for quotes: rfq-1");
  }

  @Test
  void requiresFutureDeadlineForRfqCreationAndUpdate() {
    assertThatCode(() -> transition.requireFutureDeadline(
        OffsetDateTime.now().plusDays(1),
        "rfq-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireFutureDeadline(
        OffsetDateTime.now().minusMinutes(1),
        "rfq-1"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("RFQ deadline must be in the future: rfq-1");
  }

  @Test
  void requiresOpenDeadlineForQuoteSubmission() {
    assertThatCode(() -> transition.requireOpenQuoteDeadline(
        OffsetDateTime.now().plusDays(1),
        "rfq-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireOpenQuoteDeadline(
        OffsetDateTime.now().minusMinutes(1),
        "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("RFQ quote deadline has passed: rfq-1");
  }
}
