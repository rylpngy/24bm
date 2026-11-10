package com.procurement.agency.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyPostRecords {
  public record Result(
      String id,
      String tenantId,
      String packageId,
      String sessionId,
      int ordinal,
      String previousId,
      String kind,
      String reportId,
      String sourceFingerprint,
      String snapshotJson,
      String frozenHash,
      String createdBy,
      OffsetDateTime createdAt) {}

  public record Decision(
      String sessionId,
      String expectedPreviousId,
      String kind,
      String reportId,
      String participationId,
      String authorityMode,
      String authorityName,
      String authorityRole,
      String authorityScope,
      OffsetDateTime confirmedAt,
      String evidenceVersionId,
      String reason,
      boolean reviewed,
      String idempotencyKey) {}

  public record ResultSnapshot(
      Decision decision,
      String reportHash,
      String recommendationHash,
      String supplierName,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal amount,
      String currency,
      String evidenceHash,
      String actorId) {}

  public record Document(
      String id,
      String tenantId,
      String packageId,
      String resultId,
      String kind,
      String snapshotJson,
      String frozenHash,
      String fileVersionId,
      String fileHash,
      String status,
      long version,
      String workflowId,
      String createdBy,
      OffsetDateTime createdAt) {}

  public record DocumentDraft(
      String resultId,
      String kind,
      String templateVersionId,
      String procurementRevisionId,
      String obligations,
      String responseCommitments,
      String text,
      String applicabilityBasis,
      boolean reviewed,
      String reason,
      String idempotencyKey) {}

  public record DocumentSnapshot(
      DocumentDraft draft,
      String resultHash,
      String templateHash,
      String procurementHash,
      String purchaser,
      String supplier,
      String title,
      String number,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal amount,
      String currency) {}

  public record Submit(
      Long expectedVersion, String reason, Map<String, Object> formData, String idempotencyKey) {}

  public record Action(
      Long expectedVersion,
      String action,
      OffsetDateTime occurredAt,
      String evidenceVersionId,
      String recipient,
      String channel,
      String reference,
      String signedFileVersionId,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal actualAmount,
      String reason,
      boolean reviewed,
      String idempotencyKey) {}

  public record Event(
      String id,
      String tenantId,
      String packageId,
      String objectId,
      String kind,
      String snapshotJson,
      String frozenHash,
      String createdBy,
      OffsetDateTime createdAt) {}

  public record Issue(
      String id,
      String tenantId,
      String packageId,
      long version,
      String status,
      String snapshotJson,
      String createdBy,
      OffsetDateTime createdAt) {}

  public record IssueDraft(
      Long expectedVersion,
      String kind,
      String title,
      String ownerId,
      OffsetDateTime occurredAt,
      OffsetDateTime deadline,
      String evidenceVersionId,
      String status,
      String authorityDecision,
      String authorityEffect,
      String handlingNote,
      boolean reviewed,
      String idempotencyKey) {}

  public record Control(
      String tenantId,
      String packageId,
      String state,
      long version,
      String evidenceHash,
      String authorityNote,
      String updatedBy,
      OffsetDateTime updatedAt) {}

  public record SourceReport(
      String id,
      String title,
      List<com.procurement.agency.domain.AgencyRecommendationRecords.Candidate> candidates) {}

  public record ResultSource(
      String sessionId,
      int roundOrdinal,
      String procurementRevisionId,
      List<SourceReport> reports) {}

  public record Workspace(
      List<ResultSource> sources,
      String controlState,
      List<Result> results,
      List<Document> documents,
      List<Event> events,
      List<Issue> issues) {}
}
