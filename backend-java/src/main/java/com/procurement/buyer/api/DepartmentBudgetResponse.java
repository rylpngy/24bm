package com.procurement.buyer.api;

import java.math.BigDecimal;

// disbursed=null 不可当作零元；pendingAllocationAmount 为相关待分摊净额，跨部门重复展示不可相加。
// unverifiedPaymentCount 为已标付款却无流水的发票数，此类实付未知，必须人工核对。
public record DepartmentBudgetResponse(
    String id,
    String departmentId,
    String departmentName,
    String period,
    BigDecimal totalAmount,
    BigDecimal committed,
    BigDecimal pending,
    BigDecimal remaining,
    Integer occupancyPercent,
    boolean overBudget,
    BigDecimal disbursed,
    BigDecimal pendingAllocationAmount,
    Long unverifiedPaymentCount) {
  public DepartmentBudgetResponse(String id, String departmentId, String departmentName, String period,
      BigDecimal totalAmount, BigDecimal committed, BigDecimal pending, BigDecimal remaining,
      Integer occupancyPercent, boolean overBudget, BigDecimal disbursed) {
    this(id, departmentId, departmentName, period, totalAmount, committed, pending, remaining,
        occupancyPercent, overBudget, disbursed, BigDecimal.ZERO, 0L);
  }
}
