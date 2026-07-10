package com.procurement.platform.api;

import java.time.OffsetDateTime;

// 企业准入审核时间线一条。fromStatusLabel/toStatusLabel 为阶段中文。
public record EnterpriseReviewEventResponse(
    String id,
    String action,
    String fromStatus,
    String fromStatusLabel,
    String toStatus,
    String toStatusLabel,
    String comment,
    String actorId,
    OffsetDateTime createdAt) {
}
