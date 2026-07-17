package com.procurement.tender.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record TenderInquiry(
    String id,
    String tenantId,
    String tenderId,
    String bidId,
    String kind,
    String question,
    OffsetDateTime askedAt,
    String answer,
    BigDecimal revisedAmount,
    OffsetDateTime answeredAt) {
}
