package com.procurement.buyer.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public final class ProjectLifecycleContracts {
  private ProjectLifecycleContracts() {}

  @Schema(name = "ProjectLifecycleRequest")
  public record Request(
      @Min(1) int revision,
      @NotBlank @Pattern(regexp = "carryover|liquidation") String kind,
      @Pattern(regexp = "20[0-9]{2}") String targetPeriod,
      @NotBlank @Size(max = 1000) String reason,
      Map<String, Object> formData) {}

  @Schema(name = "ProjectLifecycleSource")
  public record Source(
      String departmentId,
      String period,
      String sourceType,
      String sourceId,
      BigDecimal pending,
      BigDecimal committed,
      BigDecimal orderAmount,
      BigDecimal paidAmount) {}

  @Schema(name = "ProjectLifecycleRecord")
  public record Record(
      String id,
      String tenantId,
      String projectId,
      String kind,
      String sourcePeriod,
      String targetPeriod,
      int projectRevision,
      String reason,
      String snapshot,
      BigDecimal amount,
      String status,
      int revision,
      String workflowInstanceId,
      String createdBy,
      OffsetDateTime createdAt,
      String completedBy,
      OffsetDateTime completedAt) {}

  @Schema(name = "ProjectLifecyclePreview")
  public record Preview(
      String businessPeriod,
      String effectivePeriod,
      BigDecimal amount,
      BigDecimal paidAmount,
      BigDecimal transferAmount,
      List<PaymentBasis> payments,
      List<Source> sources,
      List<String> carryoverBlockers,
      List<String> liquidationBlockers) {}

  @Schema(name = "ProjectCarryoverPaymentBasis")
  public record PaymentBasis(
      String id,
      String invoiceId,
      String orderId,
      String rfqId,
      BigDecimal amount,
      String evidenceNo) {}

  @Schema(name = "ProjectLifecyclePage")
  public record Page(List<Record> items, long total, int page, int pageSize) {}
}
