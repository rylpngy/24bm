package com.procurement.ludongpoc.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record LudongPocApplication(
    String id,
    String tenantId,
    String applicationNo,
    String projectName,
    String applicantUnit,
    String departmentId,
    BigDecimal budgetAmount,
    String status,
    String formDataJson,
    String itemsJson,
    String createdBy,
    String submittedBy,
    OffsetDateTime submittedAt,
    OffsetDateTime approvedAt,
    OffsetDateTime archivedAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
