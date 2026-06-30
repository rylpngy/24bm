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

  @Test
  void allowsBidOpeningOnlyFromSealedQuotingRfq() {
    assertThatCode(() -> transition.requireQuotingForOpen(RfqStatus.QUOTING, "rfq-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireQuotingForOpen(RfqStatus.OPENED, "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only sealed (quoting) RFQs can be opened: rfq-1");
  }

  @Test
  void requiresDeadlinePassedUnlessForceOpen() {
    // 已过截止:正常开标,无需强制。
    assertThatCode(() -> transition.requireDeadlinePassedOrForce(
        OffsetDateTime.now().minusMinutes(1), false, "rfq-1"))
        .doesNotThrowAnyException();
    // 未过截止 + 未强制:拦截。
    assertThatThrownBy(() -> transition.requireDeadlinePassedOrForce(
        OffsetDateTime.now().plusDays(1), false, "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("force open required: rfq-1");
    // 未过截止 + 强制:放行。
    assertThatCode(() -> transition.requireDeadlinePassedOrForce(
        OffsetDateTime.now().plusDays(1), true, "rfq-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void sealsEvaluationUntilBidsAreOpened() {
    assertThatThrownBy(() -> transition.requireOpenedForEvaluation(RfqStatus.QUOTING, "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("sealed until bids are opened: rfq-1");

    assertThatCode(() -> transition.requireOpenedForEvaluation(RfqStatus.OPENED, "rfq-1"))
        .doesNotThrowAnyException();
    assertThatCode(() -> transition.requireOpenedForEvaluation(RfqStatus.AWARDED, "rfq-1"))
        .doesNotThrowAnyException();
  }
}
