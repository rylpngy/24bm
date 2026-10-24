package com.procurement.buyer.domain;

import java.math.BigDecimal;

public record BudgetPosition(String departmentId, String departmentName, String period, BigDecimal totalAmount,
    long version, BigDecimal pending, BigDecimal committed, BigDecimal orderAmount, BigDecimal paidAmount,
    BigDecimal releasedAmount, boolean configured) {
  public BigDecimal occupied() { return pending.add(committed); }
  public BigDecimal remaining() { return totalAmount.subtract(occupied()); }
}
