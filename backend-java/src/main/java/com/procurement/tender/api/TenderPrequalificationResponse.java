package com.procurement.tender.api;

import java.time.OffsetDateTime;

public record TenderPrequalificationResponse(
    String id,
    String supplierId,
    String supplierName,
    String application,
    String status,
    String reviewComment,
    OffsetDateTime appliedAt,
    OffsetDateTime reviewedAt) {
}
