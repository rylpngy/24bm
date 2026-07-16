package com.procurement.tender.domain;

import java.time.OffsetDateTime;

public record TenderAcquisition(
    String id,
    String tenantId,
    String tenderId,
    String supplierId,
    String source,
    OffsetDateTime acquiredAt,
    OffsetDateTime createdAt) {
}
