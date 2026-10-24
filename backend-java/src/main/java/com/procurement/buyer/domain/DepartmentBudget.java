package com.procurement.buyer.domain;

import java.math.BigDecimal;

// 实付来自付款净流水；null 表示预算不可分摊或历史付款缺流水，不代表零元。
public record DepartmentBudget(
    String id,
    String departmentId,
    String departmentName,
    String period,
    BigDecimal totalAmount,
    BigDecimal committed,
    BigDecimal pending,
    BigDecimal disbursed,
    BigDecimal pendingAllocationAmount,
    Long unverifiedPaymentCount) {
  public DepartmentBudget(String id, String departmentId, String departmentName, String period,
      BigDecimal totalAmount, BigDecimal committed, BigDecimal pending, BigDecimal disbursed) {
    this(id, departmentId, departmentName, period, totalAmount, committed, pending, disbursed, BigDecimal.ZERO, 0L);
  }
}
