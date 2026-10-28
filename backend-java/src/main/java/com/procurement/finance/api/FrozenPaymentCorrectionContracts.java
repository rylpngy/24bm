package com.procurement.finance.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public final class FrozenPaymentCorrectionContracts {
  private FrozenPaymentCorrectionContracts() {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "FrozenCorrectionFundingTarget")
  public record FundingTarget(
      @NotBlank String sourceFundId,
      @NotBlank String targetFundId,
      @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal amount) {
    public FundingTarget(String sourceFundId, String targetFundId) {
      this(sourceFundId, targetFundId, null);
    }
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "FrozenPaymentCorrectionRequest")
  public record Request(
      @NotBlank @Size(max = 100) String requestKey,
      @NotBlank String entryId,
      @NotBlank @Size(max = 200) String evidenceNo,
      @NotBlank @Size(max = 1000) String reason,
      Map<String, Object> formData,
      @Size(max = 30) List<@Valid FundingTarget> fundingTargets,
      @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal amount) {
    public Request(
        String requestKey,
        String entryId,
        String evidenceNo,
        String reason,
        Map<String, Object> formData,
        List<FundingTarget> fundingTargets) {
      this(requestKey, entryId, evidenceNo, reason, formData, fundingTargets, null);
    }

    public Request(
        String requestKey,
        String entryId,
        String evidenceNo,
        String reason,
        Map<String, Object> formData) {
      this(requestKey, entryId, evidenceNo, reason, formData, null, null);
    }
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "FrozenPaymentCorrectionCandidate")
  public record Candidate(
      String entryId,
      BigDecimal amount,
      String evidenceNo,
      String projectId,
      String sourcePeriod,
      String targetPeriod,
      List<String> blockers,
      boolean fundingRequired,
      BigDecimal remainingAmount) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "FrozenPaymentCorrection")
  public record Correction(
      String id,
      String tenantId,
      String invoiceId,
      String entryId,
      String requestKey,
      String projectId,
      String departmentId,
      String rfqId,
      String sourcePeriod,
      String targetPeriod,
      BigDecimal amount,
      String evidenceNo,
      String reason,
      String snapshot,
      String status,
      int revision,
      String workflowInstanceId,
      String reversalId,
      String createdBy,
      OffsetDateTime createdAt,
      String completedBy,
      OffsetDateTime completedAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "FrozenPaymentCorrectionPage")
  public record Page(List<Correction> items, long total, int page, int pageSize) {}
}
