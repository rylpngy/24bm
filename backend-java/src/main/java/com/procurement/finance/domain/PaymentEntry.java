package com.procurement.finance.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record PaymentEntry(String id, String tenantId, String invoiceId, String idempotencyKey,
    BigDecimal amount, String milestoneId, String evidenceNo, String remark, String reversalOf,
    String createdBy, OffsetDateTime createdAt) {}
