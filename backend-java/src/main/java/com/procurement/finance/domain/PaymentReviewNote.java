package com.procurement.finance.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record PaymentReviewNote(String id, String tenantId, String invoiceId, String idempotencyKey,
    BigDecimal reportedPaidAmount, String evidenceReference, String explanation, String snapshot,
    String createdBy, OffsetDateTime createdAt) {}
