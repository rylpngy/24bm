package com.procurement.tender.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record TenderBid(
    String id,
    String tenantId,
    String tenderId,
    String supplierId,
    BigDecimal bidAmount,
    String documentHtml,
    String contentDigest,
    String sealedStatus,
    OffsetDateTime submittedAt,
    OffsetDateTime withdrawnAt) {
}
