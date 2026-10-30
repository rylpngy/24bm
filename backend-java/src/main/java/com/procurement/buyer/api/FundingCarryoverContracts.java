package com.procurement.buyer.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.util.List;

public final class FundingCarryoverContracts {
  private FundingCarryoverContracts() {}

  @Schema(name = "FundingCarryoverMapping")
  public record Mapping(@NotBlank String sourceFundId, @NotBlank String targetFundId) {}

  @Schema(name = "FundingCarryoverOptions")
  public record Options(
      boolean enabled,
      String sourcePeriod,
      BigDecimal priorPaidAmount,
      List<FundingContracts.Balance> sources,
      List<FundingContracts.Fund> choices) {}

  @Schema(name = "FundingCarryoverLine")
  public record Line(
      String sourceFundId,
      String sourceCode,
      String sourceName,
      BigDecimal originalAllocation,
      BigDecimal retainedPaidAmount,
      String targetFundId,
      String targetCode,
      String targetName,
      int targetRevision,
      BigDecimal amount) {}

  @Schema(name = "FundingCarryoverSnapshot")
  public record Snapshot(
      String projectId,
      String previousPlan,
      String sourcePeriod,
      String targetPeriod,
      BigDecimal paidBasis,
      List<Line> lines) {}
}
