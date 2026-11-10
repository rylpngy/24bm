package com.procurement.agency.domain;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyRecommendationRecords {
  private AgencyRecommendationRecords() {}

  @Schema(name = "AgencyRecommendationRule")
  public record Rule(String ordering, int candidateCount, String tieHandling, String ruleText) {}

  @Schema(name = "AgencyRecommendationInputs")
  public record Inputs(
      String priceCalculationId,
      String totalSnapshotId,
      Rule documentRule,
      Rule configuredRule,
      String locator) {}

  @Schema(name = "AgencyRecommendationCandidate")
  public record Candidate(
      String participationId,
      String supplierName,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal metric,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal responseAmount,
      String currency,
      String sourceId) {}

  @Schema(name = "AgencyRecommendationPreview")
  public record Preview(
      String method,
      String sourceFingerprint,
      Inputs inputs,
      List<Candidate> comparisons,
      List<List<String>> ties,
      List<String> blockers) {}

  @Schema(name = "AgencyRecommendationConfirm")
  public record Confirm(
      Inputs inputs,
      String expectedFingerprint,
      List<String> participationIds,
      String evidenceVersionId,
      String tieEvidenceVersionId,
      String tieReason,
      boolean reviewed,
      String reason,
      String idempotencyKey) {}

  @Schema(name = "AgencyRecommendationSnapshot")
  public record Snapshot(
      String packageId,
      String sessionId,
      String roundHash,
      String method,
      Inputs inputs,
      List<Candidate> comparisons,
      List<Candidate> candidates,
      List<List<String>> ties,
      String evidenceVersionId,
      String evidenceHash,
      String tieEvidenceVersionId,
      String tieEvidenceHash,
      String tieReason,
      String reason,
      String sourceFingerprint,
      String actorId) {}

  @Schema(name = "AgencyRecommendation")
  public record Recommendation(
      String id,
      String tenantId,
      String packageId,
      String sessionId,
      String roundId,
      int ordinal,
      String sourceFingerprint,
      String snapshotJson,
      String frozenHash,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "AgencyReportNarrative")
  public record Narrative(
      String reviewProcess, String reasoning, String exceptionHandling, String conclusion) {}

  @Schema(name = "AgencyEvaluationReport")
  public record Report(
      String id,
      String tenantId,
      String packageId,
      String sessionId,
      String recommendationId,
      String status,
      long version,
      String narrativeJson,
      String artifactVersionId,
      String artifactHash,
      Long artifactBasisVersion,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "AgencyReportArtifact")
  public record Artifact(
      String id,
      String tenantId,
      String reportId,
      long reportVersion,
      String fileVersionId,
      String fileHash,
      String sourceFingerprint,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "AgencyReportSubmission")
  public record Submission(
      String id,
      String tenantId,
      String reportId,
      long reportVersion,
      String sourceFingerprint,
      String snapshotJson,
      String frozenHash,
      String status,
      String workflowId,
      String resultNote,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "AgencyReportDraft")
  public record Draft(
      String recommendationId, Long expectedVersion, Narrative narrative, String idempotencyKey) {}

  @Schema(name = "AgencyReportCommand")
  public record Command(
      Long expectedVersion,
      String expectedFingerprint,
      boolean reviewed,
      String reason,
      Map<String, Object> formData,
      String idempotencyKey) {}

  @Schema(name = "AgencyRecommendationHistory")
  public record History(Recommendation recommendation, boolean stale) {}

  @Schema(name = "AgencyRecommendationWorkspace")
  public record Workspace(
      String sourceFingerprint,
      List<History> recommendations,
      List<Report> reports,
      List<Artifact> artifacts,
      List<Submission> submissions,
      List<String> blockers) {}
}
