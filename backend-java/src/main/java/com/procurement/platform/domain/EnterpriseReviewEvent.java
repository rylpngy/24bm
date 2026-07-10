package com.procurement.platform.domain;

import java.time.OffsetDateTime;

// 企业准入审核事件(时间线一条):某次状态流转的留痕。
public record EnterpriseReviewEvent(
    String id,
    String enterpriseId,
    String actorId,
    String action,
    String fromStatus,
    String toStatus,
    String comment,
    OffsetDateTime createdAt) {
}
