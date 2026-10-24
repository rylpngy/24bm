package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.procurement.order.domain.OrderFulfillmentLine;
import com.procurement.order.domain.OrderFulfillmentPolicy;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class OrderPartialFulfillmentTests {
  private BigDecimal n(String value) { return new BigDecimal(value); }
  private OrderFulfillmentLine line(String shipped, String received) {
    return new OrderFulfillmentLine("line-1", n("10"), n(shipped), n(received), n(received));
  }

  @Test void allowsSubsequentBatchesAndOnlyClosesAtFullReceipt() {
    assertThatCode(() -> OrderFulfillmentPolicy.ship(line("4", "2"), n("6"))).doesNotThrowAnyException();
    assertThatCode(() -> OrderFulfillmentPolicy.receive(line("7", "2"), n("5"), n("4"))).doesNotThrowAnyException();
    assertThat(OrderFulfillmentPolicy.complete(List.of(line("10", "7")))).isFalse();
    assertThat(OrderFulfillmentPolicy.complete(List.of(line("10", "10")))).isTrue();
    assertThat(OrderFulfillmentPolicy.complete(List.of())).isFalse();
  }

  @Test void rejectsOverShipmentAndOverReceiptIncludingPreviouslyConsumedCapacity() {
    assertThatThrownBy(() -> OrderFulfillmentPolicy.ship(line("4", "2"), n("7"))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> OrderFulfillmentPolicy.receive(line("7", "2"), n("6"), n("6"))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> OrderFulfillmentPolicy.receive(line("12", "9"), n("2"), n("2"))).isInstanceOf(IllegalArgumentException.class);
  }

  @Test void rejectsInvalidQuantitiesAndHeadLineDisagreement() {
    for (String invalid : List.of("0", "-1")) {
      assertThatThrownBy(() -> OrderFulfillmentPolicy.ship(line("0", "0"), n(invalid))).isInstanceOf(IllegalArgumentException.class);
      assertThatThrownBy(() -> OrderFulfillmentPolicy.receive(line("10", "0"), n(invalid), n("0"))).isInstanceOf(IllegalArgumentException.class);
    }
    assertThatThrownBy(() -> OrderFulfillmentPolicy.receive(line("10", "0"), n("2"), n("3"))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> OrderFulfillmentPolicy.receive(line("10", "0"), n("2"), n("-1"))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> OrderFulfillmentPolicy.requireTotal(2, n("3"))).isInstanceOf(IllegalArgumentException.class);
    assertThatCode(() -> OrderFulfillmentPolicy.requireTotal(2, n("2.0000"))).doesNotThrowAnyException();
  }
}
