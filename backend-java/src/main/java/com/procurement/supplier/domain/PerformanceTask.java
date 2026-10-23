package com.procurement.supplier.domain;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PerformanceTask(String id, String tenantId, String supplierId, String relationId,
    String supplierName, String buyerName, String period, String assigneeId, String assigneeName,
    LocalDate dueDate, String status, String evaluationId, BigDecimal totalScore,
    String requirement, String response, long version) {}
