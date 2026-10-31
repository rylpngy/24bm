package com.procurement.contract.api;

import com.procurement.attachment.application.AttachmentTextExtractor.Segment;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.List;

public final class ContractReviewContracts {
  private ContractReviewContracts() {}
  @io.swagger.v3.oas.annotations.media.Schema(name = "ContractReviewRule")
  public record Rule(@NotBlank @Pattern(regexp="[A-Za-z][A-Za-z0-9_]{0,59}") String id,
      @NotBlank @Size(max=120) String title, @NotBlank String type, @NotBlank String perspective,
      @NotBlank String severity, @NotBlank String matchMode,
      @NotNull @Size(max=16) List<@NotBlank @Size(max=120) String> keywords,
      @NotBlank @Size(max=200) String sourceName, @NotBlank @Size(max=120) String clause,
      @NotBlank @Size(max=2000) String basis, @NotBlank @Size(max=4000) String suggestion) {}
  public record SaveRules(@NotBlank @Size(max=200) String name, @NotNull Integer expectedRevision,
      @NotEmpty @Size(max=30) List<@NotNull @Valid Rule> rules) {}
  public record Publish(@NotNull Integer expectedRevision) {}
  public record Start(@NotBlank String rulesVersionId, @NotBlank String perspective, @NotNull Integer expectedVersion,
      boolean useModel) {}
  public record Decide(@NotBlank String findingId, @NotBlank String action, @NotNull Integer expectedVersion,
      @Size(max=4000) String replacement, @NotBlank @Size(max=2000) String comment) {}
  @io.swagger.v3.oas.annotations.media.Schema(name = "ContractReviewFinding")
  public record Finding(String id,String ruleId,String title,String severity,String origin,String locator,
      String quote,String explanation,String suggestion,String sourceName,String clause,String basis) {}
  public record RuleSet(String id,String name,int revision,List<Rule> rules) {}
  public record RuleVersion(String id,String setId,int version,String name,List<Rule> rules,String createdBy,OffsetDateTime createdAt) {}
  @io.swagger.v3.oas.annotations.media.Schema(name = "ContractReviewDocument")
  public record Document(String id,String contractId,String fileName,String originalSha256,int currentVersion,
      List<String> limitations,String createdBy,OffsetDateTime createdAt) {}
  public record DocumentVersion(int version,String textSha256,List<Segment> segments,String createdBy,OffsetDateTime createdAt) {}
  @io.swagger.v3.oas.annotations.media.Schema(name = "ContractReviewRun")
  public record Run(String id,String documentId,int documentVersion,String rulesVersionId,String perspective,
      String mode,String model,String limitation,List<Finding> findings,String createdBy,String actorName,OffsetDateTime createdAt) {}
  @io.swagger.v3.oas.annotations.media.Schema(name = "ContractReviewDecision")
  public record Decision(String id,String runId,String findingId,String action,int oldVersion,int newVersion,
      String locator,String beforeText,String afterText,String comment,String actorId,String actorName,OffsetDateTime createdAt) {}
  @io.swagger.v3.oas.annotations.media.Schema(name = "ContractReviewWorkspace")
  public record Workspace(Document document,List<DocumentVersion> versions,List<Run> runs,List<Decision> decisions) {}
  public record Page<T>(List<T> items,long total,int page,int pageSize) {}
}
