package com.procurement.demand.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record PurchaseDemand(
    String id,
    String tenantId,
    String title,
    String departmentId,
    String requesterId,
    BigDecimal budget,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    LocalDate expectedDeliveryDate,
    String priority,
    String purpose,
    String source) {
}
