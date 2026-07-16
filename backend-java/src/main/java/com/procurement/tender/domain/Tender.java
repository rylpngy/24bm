package com.procurement.tender.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record Tender(
    String id,
    String tenantId,
    String tenderNo,
    String title,
    String tenderType,
    BigDecimal budget,
    String status,
    String documentHtml,
    String evaluationMethod,
    BigDecimal bidBondAmount,
    OffsetDateTime acquisitionDeadline,
    OffsetDateTime submissionDeadline,
    OffsetDateTime openingAt,
    String ownerId,
    OffsetDateTime publishedAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    OffsetDateTime openedAt,
    String awardedBidId,
    OffsetDateTime awardedAt,
    String awardNoticeHtml) {
}
