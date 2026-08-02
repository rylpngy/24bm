package com.procurement.tender.domain;

import java.time.OffsetDateTime;

public record TenderPrequalification(
    String id,
    String tenantId,
    String tenderId,
    String supplierId,
    String application,
    String status,
    String reviewComment,
    OffsetDateTime appliedAt,
    OffsetDateTime reviewedAt) {
}
