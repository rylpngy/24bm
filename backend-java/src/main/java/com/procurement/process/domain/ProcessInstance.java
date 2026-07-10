package com.procurement.process.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record ProcessInstance(
    String id,
    String tenantId,
    String processId,
    String processName,
    BigDecimal amount,
    String formData,
    String resolvedPath,
    int currentIndex,
    String status,
    String initiatorId,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
