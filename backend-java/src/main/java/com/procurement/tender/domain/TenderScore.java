package com.procurement.tender.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record TenderScore(
    String id,
    String tenantId,
    String tenderId,
    String bidId,
    String evaluatorId,
    BigDecimal technicalScore,
    BigDecimal commercialScore,
    String comment,
    OffsetDateTime scoredAt) {
}
