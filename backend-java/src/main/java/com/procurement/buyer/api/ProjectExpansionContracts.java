package com.procurement.buyer.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public final class ProjectExpansionContracts {
  private ProjectExpansionContracts() {}

  @Schema(name = "ProjectAllocationBalance")
  public record Balance(
      String materialId, BigDecimal approved, BigDecimal allocated, BigDecimal remaining) {}

  @Schema(name = "ProjectPackageAllocation")
  public record Allocation(
      @NotBlank String materialId,
      @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal quantity) {}

  @Schema(name = "ProjectPackageDraft")
  public record PackageDraft(
      @Min(1) int projectRevision,
      @Min(0) int revision,
      @NotBlank @Size(max = 200) String title,
      @NotEmpty @Size(max = 100) List<@Valid Allocation> lines,
      @Size(max = 100) List<@NotBlank String> demandIds) {}

  @Schema(name = "ProjectPackageAction")
  public record PackageAction(@Min(1) int revision, @NotBlank @Size(max = 1000) String reason) {}

  @Schema(name = "ProjectPackageExecutionRequest")
  public record PackageExecution(
      @Min(1) int revision,
      @NotBlank @Pattern(regexp = "rfq|tender|auction") String type,
      @NotBlank @Size(max = 1000) String reason,
      @DecimalMin(value = "0", inclusive = false) BigDecimal startPrice,
      @DecimalMin("0") BigDecimal minDecrement,
      OffsetDateTime startsAt,
      @Future OffsetDateTime deadlineAt,
      @Min(0) @Max(120) Integer softCloseTriggerMinutes,
      @Min(0) @Max(120) Integer softCloseExtendMinutes) {
    public PackageExecution(int revision, String type, String reason) {
      this(revision, type, reason, null, null, null, null, null, null);
    }
    public PackageExecution(int revision, String type, String reason, BigDecimal startPrice,
        BigDecimal minDecrement, OffsetDateTime startsAt, OffsetDateTime deadlineAt) {
      this(revision,type,reason,startPrice,minDecrement,startsAt,deadlineAt,null,null);
    }
  }

  @Schema(name = "ProjectPackageDemandLink")
  public record PackageDemandLink(@Min(1) int revision, @NotBlank String demandId) {}

  @Schema(name = "ProjectPackageRecord")
  public record PackageRow(
      String id,
      String tenantId,
      String projectId,
      String title,
      String status,
      int revision,
      int projectRevision,
      BigDecimal amount,
      String lines,
      String snapshot,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "ProjectExecutionRun")
  public record Run(
      String id,
      String tenantId,
      String projectId,
      String packageId,
      String executionType,
      String executionId,
      String status,
      String reason,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "ProjectPackageDetail")
  public record PackageDetail(
      PackageRow info,
      List<ProjectContracts.Line> lines,
      List<ProjectContracts.Demand> demands,
      List<Run> runs,
      java.util.Map<String, String> sourceStatuses,
      java.util.Map<String, String> sourceMethods) {}

  @Schema(name = "ProjectChangeDraft")
  public record ChangeDraft(
      @Min(1) int projectRevision,
      @Min(0) int revision,
      @NotBlank @Size(max = 1000) String reason,
      @NotNull @Valid ProjectContracts.Draft proposal) {}

  @Schema(name = "ProjectChangeRequest")
  public record Change(
      String id,
      String tenantId,
      String projectId,
      int basedRevision,
      String beforeSnapshot,
      String proposal,
      BigDecimal amount,
      String reason,
      String status,
      int revision,
      String workflowInstanceId,
      Integer resultRevision,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "ProjectChangePage")
  public record ChangePage(
      List<Change> items,
      long total,
      int page,
      int pageSize,
      boolean pending,
      boolean hasOpenChange) {}
}
