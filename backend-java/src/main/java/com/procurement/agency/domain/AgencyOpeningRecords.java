package com.procurement.agency.domain;

import com.procurement.agency.domain.AgencyAssessmentRecords.Subject;
import com.procurement.agency.domain.AgencyRecords.FileView;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyOpeningRecords {
  private AgencyOpeningRecords() {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningItem")
  public record Item(String key, String title, boolean required, List<String> readerRoles) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningConfig")
  public record Config(
      OffsetDateTime cutoffAt,
      OffsetDateTime notBefore,
      int minimumSubjects,
      String ruleBasis,
      List<Item> items) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningPlan")
  public record Plan(
      String tenantId,
      String roundId,
      String packageId,
      String status,
      long version,
      String configJson,
      String createdBy,
      OffsetDateTime updatedAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningPlanSave")
  public record PlanSave(
      Long expectedVersion, Config config, String reason, String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningConfirm")
  public record Confirm(
      Long expectedVersion, boolean reviewed, String reason, String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningReceipt")
  public record Receipt(
      String id,
      String tenantId,
      String packageId,
      String roundId,
      String participationId,
      String itemKey,
      String fileId,
      OffsetDateTime receivedAt,
      String originalType,
      String sourceNote,
      String note,
      String lateEntryReason,
      String status,
      long version,
      String createdBy,
      OffsetDateTime createdAt,
      String withdrawReason) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningReceiptDraft")
  public record ReceiptDraft(
      String participationId,
      String itemKey,
      String fileName,
      OffsetDateTime receivedAt,
      String originalType,
      String sourceNote,
      String note,
      String lateEntryReason,
      String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningReceiptView")
  public record ReceiptView(Receipt receipt, FileView file, boolean readable) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningManifest")
  public record Manifest(
      String receiptId,
      String participationId,
      String itemKey,
      String fileId,
      String fileVersionId,
      String attachmentId,
      String fileName,
      String hash,
      List<String> readerRoles) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningOpening")
  public record Opening(
      String id,
      String tenantId,
      String packageId,
      String roundId,
      String manifestJson,
      String manifestHash,
      String subjectsJson,
      OffsetDateTime openedAt,
      String evidenceVersionId,
      String evidenceHash,
      String note,
      String createdBy,
      OffsetDateTime createdAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningSummary")
  public record Summary(
      String id,
      String manifestHash,
      List<Subject> subjects,
      OffsetDateTime openedAt,
      String evidenceVersionId,
      String note) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningWorkspace")
  public record Workspace(
      Plan plan, Config config, List<ReceiptView> receipts, Summary opening, List<String> issues) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningPreview")
  public record Preview(
      Long planVersion,
      List<Subject> subjects,
      List<Manifest> manifest,
      List<String> blockers,
      String fingerprint) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningOpen")
  public record Open(
      Long expectedVersion,
      List<String> participationIds,
      String previewFingerprint,
      OffsetDateTime openedAt,
      String evidenceVersionId,
      boolean reviewed,
      String note,
      String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningRelease")
  public record Release(
      String id,
      String tenantId,
      String sessionId,
      String stageKey,
      String subjectsJson,
      String prerequisiteHash,
      String evidenceVersionId,
      String evidenceHash,
      String note,
      String exclusionsJson,
      String createdBy,
      OffsetDateTime createdAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningCandidate")
  public record Candidate(String participationId, String supplierName, boolean priorPassed) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningStageView")
  public record StageView(
      String stageKey,
      boolean released,
      boolean complete,
      List<Candidate> candidates,
      String prerequisiteHash) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningStageBoard")
  public record StageBoard(List<StageView> stages) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyOpeningReleaseDraft")
  public record ReleaseDraft(
      List<String> participationIds,
      Map<String, String> exclusions,
      String prerequisiteHash,
      String evidenceVersionId,
      boolean reviewed,
      String note,
      String idempotencyKey) {}
}
