package com.procurement.demand.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record PurchaseDemandResponse(
    String id,
    String tenantId,
    String title,
    String departmentId,
    String requesterId,
    BigDecimal budget,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    List<PurchaseDemandLineItemResponse> lineItems,
    LocalDate expectedDeliveryDate,
    String priority,
    String purpose,
    String linkedRfqId,
    String linkedRfqStatus,
    String source) {
}
