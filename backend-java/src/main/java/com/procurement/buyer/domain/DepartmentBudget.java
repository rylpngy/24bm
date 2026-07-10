package com.procurement.buyer.domain;

import java.math.BigDecimal;

// 部门预算 + 占用(已用=已通过需求,在途=审批中需求,实付=已付里程碑),由连接查询一次取出。
public record DepartmentBudget(
    String id,
    String departmentId,
    String departmentName,
    String period,
    BigDecimal totalAmount,
    BigDecimal committed,
    BigDecimal pending,
    BigDecimal disbursed) {
}
