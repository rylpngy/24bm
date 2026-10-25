package com.procurement.buyer.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

public final class ProjectCloseoutContracts {
  private ProjectCloseoutContracts() {}

  @Schema(name = "ProjectMilestonePlan")
  public record Plan(
      @Min(1) int revision,
      @NotBlank @Pattern(regexp = "demand|sourcing|order|receipt|payment|close") String milestone,
      @NotNull LocalDate dueDate,
      @NotBlank @Size(max = 1000) String reason) {}

  @Schema(name = "ProjectMilestoneProgress")
  public record Milestone(
      String key,
      String title,
      LocalDate dueDate,
      boolean complete,
      boolean overdue,
      String evidence) {}

  @Schema(name = "ProjectPackageProgress")
  public record Progress(
      String packageId,
      String title,
      String status,
      int revision,
      List<Milestone> milestones,
      List<String> blockers,
      boolean canRework,
      boolean canStop) {}

  @Schema(name = "ProjectExecutionAdjustment")
  public record Adjustment(
      String id,
      String projectId,
      String packageId,
      String action,
      String reason,
      String snapshot,
      BigDecimal releasedAmount,
      String actorId,
      OffsetDateTime createdAt,
      String actorName) {}

  @Schema(name = "ProjectExecutionMonitor")
  public record Monitor(
      List<Progress> packages,
      int overdueCount,
      BigDecimal unallocatedAmount,
      boolean changesPending) {}

  @Schema(name = "ProjectAdjustmentPage")
  public record AdjustmentPage(List<Adjustment> items, long total, int page, int pageSize) {}
}
