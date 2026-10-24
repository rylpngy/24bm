package com.procurement.sourcing.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record ProcurementExecutionResponse(
    String rfqId, String title, String status, List<Document> documents,
    BigDecimal budgetAmount, BigDecimal orderAmount, BigDecimal invoicedAmount,
    BigDecimal paidAmount, BigDecimal remainingAmount, List<String> blockers,
    boolean canArchive, List<ArchiveSummary> archives) {
  public record Document(String id, String label, String status, BigDecimal amount, String module, String recordId) {}
  public record ArchiveSummary(String id, OffsetDateTime createdAt, String createdBy, String sha256, boolean stale) {}
}
