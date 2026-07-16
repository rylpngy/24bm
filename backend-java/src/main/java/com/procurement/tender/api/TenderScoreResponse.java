package com.procurement.tender.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record TenderScoreResponse(
    String evaluatorId,
    String bidId,
    BigDecimal technicalScore,
    BigDecimal commercialScore,
    String comment,
    OffsetDateTime scoredAt) {
}
