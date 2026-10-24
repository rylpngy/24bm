package com.procurement.order.domain;

import java.math.BigDecimal;
import java.util.List;

public final class OrderFulfillmentPolicy {
  private OrderFulfillmentPolicy() {}

  public static void ship(OrderFulfillmentLine line, BigDecimal quantity) {
    positive(quantity);
    if (line.orderedQuantity().signum() <= 0
        || line.shippedQuantity().add(quantity).compareTo(line.orderedQuantity()) > 0) {
      throw new IllegalArgumentException("Shipment exceeds ordered quantity: " + line.orderLineId());
    }
  }

  public static void receive(OrderFulfillmentLine line, BigDecimal received, BigDecimal qualified) {
    positive(received);
    if (qualified == null || qualified.signum() < 0 || qualified.stripTrailingZeros().scale() > 2 || qualified.compareTo(received) > 0) {
      throw new IllegalArgumentException("Qualified quantity must be between zero and received quantity");
    }
    BigDecimal cumulative = line.receivedQuantity().add(received);
    if (cumulative.compareTo(line.orderedQuantity()) > 0 || cumulative.compareTo(line.shippedQuantity()) > 0) {
      throw new IllegalArgumentException("Receipt exceeds shipped or ordered quantity: " + line.orderLineId());
    }
  }

  public static void requireTotal(Integer head, BigDecimal lines) {
    if (head == null || BigDecimal.valueOf(head).compareTo(lines) != 0) {
      throw new IllegalArgumentException("Header quantity must equal line total");
    }
  }

  public static boolean complete(List<OrderFulfillmentLine> lines) {
    return !lines.isEmpty() && lines.stream().allMatch(line -> line.orderedQuantity().signum() > 0
        && line.receivedQuantity().compareTo(line.orderedQuantity()) == 0);
  }

  private static void positive(BigDecimal value) {
    if (value == null || value.signum() <= 0 || value.stripTrailingZeros().scale() > 2) {
      throw new IllegalArgumentException("Quantity must be positive with at most two decimal places");
    }
  }
}
