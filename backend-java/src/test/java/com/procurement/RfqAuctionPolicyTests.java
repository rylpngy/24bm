package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.sourcing.domain.RfqAuctionPolicy;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

// 竞价出价规则:首轮不高于起拍价;有在场最低价时须至少降一个步长;非竞价方式不受约束。
class RfqAuctionPolicyTests {

  private static final BigDecimal START = new BigDecimal("10000");
  private static final BigDecimal STEP = new BigDecimal("100");

  @Test
  void nonAuctionMethodsBypassBidRules() {
    assertThatCode(() -> RfqAuctionPolicy.requireValidBid(
        "询比", null, null, new BigDecimal("50"), new BigDecimal("99999"), "rfq-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void nonAuctionMethodsRejectAuctionParams() {
    assertThatThrownBy(() -> RfqAuctionPolicy.requireValidParams("询比", START, null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("仅竞价方式");
  }

  @Test
  void auctionRequiresPositiveStartPrice() {
    assertThatThrownBy(() -> RfqAuctionPolicy.requireValidParams("竞价", null, null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("起拍价");
    assertThatThrownBy(() -> RfqAuctionPolicy.requireValidParams("竞价", BigDecimal.ZERO, null))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatCode(() -> RfqAuctionPolicy.requireValidParams("竞价", START, STEP))
        .doesNotThrowAnyException();
  }

  @Test
  void firstBidMustNotExceedStartPrice() {
    assertThatThrownBy(() -> RfqAuctionPolicy.requireValidBid(
        "竞价", START, STEP, null, new BigDecimal("10001"), "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("起拍价");
    assertThatCode(() -> RfqAuctionPolicy.requireValidBid(
        "竞价", START, STEP, null, START, "rfq-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void subsequentBidMustUndercutLowestByStep() {
    BigDecimal lowest = new BigDecimal("9000");
    assertThatThrownBy(() -> RfqAuctionPolicy.requireValidBid(
        "竞价", START, STEP, lowest, new BigDecimal("8901"), "rfq-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("至少再降");
    assertThatCode(() -> RfqAuctionPolicy.requireValidBid(
        "竞价", START, STEP, lowest, new BigDecimal("8900"), "rfq-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void missingStepDefaultsToUndercuttingCurrentLowest() {
    BigDecimal lowest = new BigDecimal("9000");
    assertThatCode(() -> RfqAuctionPolicy.requireValidBid(
        "竞价", START, null, lowest, lowest, "rfq-1"))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> RfqAuctionPolicy.requireValidBid(
        "竞价", START, null, lowest, new BigDecimal("9001"), "rfq-1"))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void auctionBidRequiresPositiveAmount() {
    assertThatThrownBy(() -> RfqAuctionPolicy.requireValidBid(
        "竞价", START, STEP, null, null, "rfq-1"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void bidInsideSoftCloseWindowExtendsDeadline() {
    java.time.OffsetDateTime deadline = java.time.OffsetDateTime.parse("2026-07-10T18:00:00+08:00");
    java.time.OffsetDateTime lastMinuteBid = deadline.minusMinutes(2);
    java.time.OffsetDateTime extended = RfqAuctionPolicy.extendedDeadline(deadline, lastMinuteBid);
    org.assertj.core.api.Assertions.assertThat(extended)
        .isEqualTo(lastMinuteBid.plus(RfqAuctionPolicy.SOFT_CLOSE_EXTENSION));
  }

  @Test
  void bidOutsideSoftCloseWindowOrAfterDeadlineDoesNotExtend() {
    java.time.OffsetDateTime deadline = java.time.OffsetDateTime.parse("2026-07-10T18:00:00+08:00");
    org.assertj.core.api.Assertions.assertThat(
        RfqAuctionPolicy.extendedDeadline(deadline, deadline.minusMinutes(30))).isNull();
    org.assertj.core.api.Assertions.assertThat(
        RfqAuctionPolicy.extendedDeadline(deadline, deadline.plusSeconds(1))).isNull();
    org.assertj.core.api.Assertions.assertThat(
        RfqAuctionPolicy.extendedDeadline(null, deadline)).isNull();
  }
}
