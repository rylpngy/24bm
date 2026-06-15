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
    OffsetDateTime updatedAt) {
}
