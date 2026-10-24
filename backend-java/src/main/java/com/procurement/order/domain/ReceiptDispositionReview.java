package com.procurement.order.domain;

import java.time.OffsetDateTime;

public record ReceiptDispositionReview(
    String id, String tenantId, String receiptId, String decision, String reason,
    String evidenceNo, String reviewedBy, OffsetDateTime reviewedAt) {}
