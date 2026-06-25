package com.procurement.platform.api;

import java.time.OffsetDateTime;

// 套餐变更记录:前后套餐与用户上限 + 升/降级方向 + 操作人/时间。
public record TenantPlanChangeResponse(
    String id,
    String fromPlan,
    String toPlan,
    int fromUserLimit,
    int toUserLimit,
    String direction,
    String changedBy,
    OffsetDateTime changedAt) {
}
