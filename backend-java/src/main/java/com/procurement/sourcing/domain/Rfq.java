package com.procurement.sourcing.domain;

import java.time.OffsetDateTime;

public record Rfq(
    String id,
    String tenantId,
    String title,
    String status,
    OffsetDateTime deadlineAt,
    String ownerId,
    String awardedSupplierId,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    String quoteRequirement,
    String deliveryRequirement,
    String evaluationMethod,
    OffsetDateTime openedAt,
    int currentRound,
    boolean finalRound,
    String method,
    String closeReason) {
  // 单一(规范)构造器:避免 MyBatis 在多构造器间按 join 查询误选,丢失 currentRound 等新列。
}
