package com.procurement.buyer.api;

import java.math.BigDecimal;

// 部门预算占用:总额/已用/在途/剩余/占用率/是否超预算。
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
    boolean overBudget) {
}
