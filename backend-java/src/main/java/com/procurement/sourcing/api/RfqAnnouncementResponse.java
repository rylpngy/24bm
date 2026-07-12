package com.procurement.sourcing.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record RfqAnnouncementResponse(
    String id,
    String rfqId,
    String type,
    String title,
    String summary,
    String method,
    OffsetDateTime deadlineAt,
    String evaluationMethod,
    String quoteRequirement,
    String deliveryRequirement,
    String awardedSupplierName,
    BigDecimal awardAmount,
    String closeReason,
    OffsetDateTime publishedAt) {
}
