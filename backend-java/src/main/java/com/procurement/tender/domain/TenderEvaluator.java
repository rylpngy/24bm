package com.procurement.tender.domain;

import java.time.OffsetDateTime;

public record TenderEvaluator(
    String id,
    String tenantId,
    String tenderId,
    String evaluatorName,
    String evaluatorRole,
    OffsetDateTime createdAt) {
}
