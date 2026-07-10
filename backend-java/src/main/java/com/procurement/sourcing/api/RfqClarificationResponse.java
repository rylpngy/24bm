package com.procurement.sourcing.api;

import java.time.OffsetDateTime;

public record RfqClarificationResponse(
    String id,
    String rfqId,
    String supplierId,
    String question,
    String answer,
    boolean answered,
    boolean published,
    OffsetDateTime askedAt,
    OffsetDateTime answeredAt) {
}
