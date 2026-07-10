package com.procurement.platform.domain;

import java.time.OffsetDateTime;

public record TenantPlanChange(
    String id,
    String tenantId,
    String fromPlan,
    String toPlan,
    int fromUserLimit,
    int toUserLimit,
    String changedBy,
    OffsetDateTime changedAt) {
}
