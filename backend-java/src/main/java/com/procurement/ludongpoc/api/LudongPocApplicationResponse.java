package com.procurement.ludongpoc.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public record LudongPocApplicationResponse(
    String id,
    String applicationNo,
    String projectName,
    String applicantUnit,
    String departmentId,
    BigDecimal budgetAmount,
    String status,
    Map<String, Object> formData,
    List<Map<String, Object>> items,
    String createdBy,
    OffsetDateTime submittedAt,
    OffsetDateTime approvedAt,
    OffsetDateTime archivedAt,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
