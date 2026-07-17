package com.procurement.tender.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record TenderInquiryResponse(
    String id,
    String bidId,
    String supplierName,
    String kind,
    String question,
    OffsetDateTime askedAt,
    String answer,
    BigDecimal revisedAmount,
    OffsetDateTime answeredAt) {
}
