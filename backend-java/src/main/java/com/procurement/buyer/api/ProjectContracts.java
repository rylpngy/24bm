package com.procurement.buyer.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public final class ProjectContracts {
  private ProjectContracts() {}

  @Schema(name = "ProcurementProject")
  public record Project(
      String id,
      String tenantId,
      String projectNo,
      String title,
      String departmentId,
      String ownerId,
      String period,
      String fundingSource,
      String purpose,
      BigDecimal plannedAmount,
      String status,
      int revision,
      String createdBy,
      String workflowInstanceId,
      String executionType,
      String executionId,
      String closeoutReason,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt,
      String departmentName,
      String ownerName) {}

  @Schema(name = "ProcurementProjectLine")
  public record Line(
      String id,
      String materialId,
      String name,
      String specification,
      String unit,
      BigDecimal quantity,
      BigDecimal unitPrice,
      String purpose) {}

  @Schema(name = "ProcurementProjectLineInput")
  public record LineInput(
      @NotBlank String materialId,
      @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal quantity,
      @NotNull @DecimalMin("0") BigDecimal unitPrice,
      @Size(max = 1000) String purpose) {}

  @Schema(name = "ProcurementProjectDraft")
  public record Draft(
      @NotBlank @Size(max = 200) String title,
      @NotBlank String departmentId,
      @NotBlank String ownerId,
      @Pattern(regexp = "20[0-9]{2}") @NotBlank String period,
      @NotBlank @Size(max = 200) String fundingSource,
      @NotBlank @Size(max = 4000) String purpose,
      @NotEmpty @Size(max = 100) List<@Valid LineInput> lines,
      @Min(0) int revision) {}

  @Schema(name = "ProcurementProjectPage")
  public record Page(List<Project> items, long total, int page, int pageSize) {}

  @Schema(name = "ProcurementProjectDetail")
  public record Detail(Project project, List<Line> lines) {}

  @Schema(name = "ProcurementProjectAction")
  public record Action(
      @Min(1) int revision,
      @NotBlank @Size(max = 1000) String reason,
      Map<String, Object> formData) {}

  @Schema(name = "ProcurementProjectLinkRequest")
  public record LinkRequest(@Min(1) int revision, @NotBlank String demandId) {}

  @Schema(name = "ProcurementProjectExecutionRequest")
  public record ExecutionRequest(
      @Min(1) int revision, @NotBlank @Pattern(regexp = "rfq|tender") String type) {}

  @Schema(name = "ProcurementProjectDemand")
  public record Demand(
      String id,
      String title,
      String status,
      BigDecimal budget,
      String departmentId,
      String requesterId,
      String period) {}

  @Schema(name = "ProcurementProjectTraceRow")
  public record Trace(
      String type,
      String id,
      String title,
      String status,
      BigDecimal amount,
      String module,
      String recordId) {}

  @Schema(name = "ProcurementProjectExecution")
  public record Execution(
      List<Demand> demands,
      List<Trace> documents,
      BigDecimal demandAmount,
      BigDecimal orderAmount,
      BigDecimal invoicedAmount,
      BigDecimal paidAmount,
      List<String> warnings,
      boolean canClose) {}

  @Schema(name = "ProcurementProjectOption")
  public record Option(String id, String name, String departmentId, String status) {}

  @Schema(name = "ProcurementProjectOptions")
  public record Options(List<Option> departments, List<Option> users) {}
}
