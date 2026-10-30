package com.procurement.buyer.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public final class FundingContracts {
  private FundingContracts() {}

  @Schema(name = "SpecialFundDraft")
  public record Draft(
      @NotBlank String departmentId,
      @NotBlank @Pattern(regexp = "20[0-9]{2}") String period,
      @NotBlank @Size(max = 50) String code,
      @NotBlank @Size(max = 200) String name) {}

  @Schema(name = "SpecialFundingShare")
  public record Share(
      @NotBlank String fundId,
      @NotNull @DecimalMin("0.01") @Digits(integer = 14, fraction = 2) BigDecimal amount) {}

  @Schema(name = "SpecialFundChangeRequest")
  public record Request(
      @NotBlank @Size(max = 100) String requestKey,
      @NotBlank @Pattern(regexp = "fund_limit|project_plan") String kind,
      String fundId,
      String projectId,
      @Min(1) int revision,
      @NotNull @DecimalMin("0") @Digits(integer = 14, fraction = 2) BigDecimal amount,
      @Size(max = 30) List<@Valid Share> lines,
      @NotBlank @Size(max = 1000) String reason,
      Map<String, Object> formData) {}

  @Schema(name = "SpecialFund")
  public record Fund(
      String id,
      String tenantId,
      String departmentId,
      String period,
      String code,
      String name,
      BigDecimal totalAmount,
      int revision,
      String status,
      String createdBy,
      BigDecimal reservedAmount,
      BigDecimal paidAmount,
      BigDecimal availableAmount) {}

  @Schema(name = "SpecialFundChange")
  public record Change(
      String id,
      String tenantId,
      String kind,
      String fundId,
      String projectId,
      String departmentId,
      String period,
      int basedRevision,
      BigDecimal amount,
      String requestKey,
      String proposal,
      String snapshot,
      String reason,
      String status,
      int revision,
      String workflowInstanceId,
      String createdBy,
      OffsetDateTime createdAt,
      String completedBy,
      OffsetDateTime completedAt) {}

  @Schema(name = "SpecialFundPage")
  public record FundPage(List<Fund> items, long total, int page, int pageSize) {}

  @Schema(name = "SpecialFundChangePage")
  public record ChangePage(List<Change> items, long total, int page, int pageSize) {}

  @Schema(name = "SpecialFundingBalance")
  public record Balance(
      String fundId,
      String code,
      String name,
      BigDecimal allocatedAmount,
      BigDecimal paidAmount,
      BigDecimal remainingAmount) {}

  @Schema(name = "SpecialFundingPaymentLine")
  public record Attribution(
      String entryId,
      String fundId,
      String code,
      BigDecimal amount,
      String evidenceNo,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "SpecialFundingProject")
  public record ProjectFunding(
      String projectId,
      boolean enabled,
      String planId,
      List<Fund> choices,
      List<Balance> sources,
      String blocker,
      String effectivePeriod,
      BigDecimal priorPaidAmount) {}
}
