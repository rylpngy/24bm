package com.procurement.supplier.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record PerformanceTaskResponse(String id, String relationId, String supplierName,
    String buyerName, String period, String assigneeId, String assigneeName, LocalDate dueDate,
    String status, String evaluationId, BigDecimal totalScore, String requirement, String response,
    List<Event> history, long version, SupplierEvaluationScoring scoring) {
  public PerformanceTaskResponse(String id, String relationId, String supplierName,
      String buyerName, String period, String assigneeId, String assigneeName, LocalDate dueDate,
      String status, String evaluationId, BigDecimal totalScore, String requirement, String response,
      List<Event> history, long version) {
    this(id, relationId, supplierName, buyerName, period, assigneeId, assigneeName, dueDate, status,
        evaluationId, totalScore, requirement, response, history, version, SupplierEvaluationScoring.legacy());
  }
  public record Event(String action, String actorName, String comment, OffsetDateTime createdAt) {}
  public record Assignee(String id, String displayName) {}
}
