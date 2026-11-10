package com.procurement.agency.domain;

import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyArchiveRecords {
  public record Checklist(
      String tenantId,
      String packageId,
      String itemKey,
      long version,
      String disposition,
      String snapshotJson,
      String updatedBy,
      OffsetDateTime updatedAt) {}

  public record ChecklistDraft(
      Long expectedVersion,
      String disposition,
      List<String> fileVersionIds,
      String paperLocation,
      String signingStatus,
      String ownerId,
      OffsetDateTime deadline,
      String reason,
      String evidenceVersionId,
      boolean reviewed,
      String idempotencyKey) {}

  public record Requirement(
      String key, String title, String applicability, boolean systemPresent, String basis) {}

  public record ChecklistView(
      String key,
      String title,
      String applicability,
      boolean systemPresent,
      Long version,
      String disposition,
      List<String> visibleFileVersionIds,
      int withheldCount,
      String paperLocation,
      String signingStatus,
      String ownerId,
      OffsetDateTime deadline,
      String reason) {}

  public record Snapshot(
      String id,
      String tenantId,
      String packageId,
      int ordinal,
      String previousId,
      String snapshotJson,
      String frozenHash,
      String sourceFingerprint,
      boolean complete,
      String reason,
      String createdBy,
      OffsetDateTime createdAt) {}

  public record SnapshotView(
      String id,
      int ordinal,
      String previousId,
      String frozenHash,
      boolean complete,
      boolean stale,
      String reason,
      String createdBy,
      OffsetDateTime createdAt) {}

  public record Entry(
      String fileId,
      String versionId,
      String name,
      String category,
      int ordinal,
      String hash,
      long size,
      String source,
      String signingStatus) {}

  public record Freeze(
      String expectedFingerprint,
      String expectedPreviousId,
      boolean complete,
      int retentionYears,
      String reason,
      boolean reviewed,
      String idempotencyKey) {}

  public record Completion(
      String tenantId,
      String packageId,
      long version,
      String businessNote,
      String financialNote,
      String archiveNote,
      int retentionYears,
      String updatedBy,
      OffsetDateTime updatedAt) {}

  public record StateChange(
      Long expectedVersion,
      String dimension,
      String status,
      String reason,
      String evidenceVersionId,
      String remainingMatters,
      String ownerId,
      boolean reviewed,
      String idempotencyKey) {}

  public record CompletionEvent(
      String id,
      String tenantId,
      String packageId,
      String dimension,
      String snapshotJson,
      String frozenHash,
      String createdBy,
      OffsetDateTime createdAt) {}

  public record Workspace(
      Completion state,
      String businessStatus,
      String archiveCompletion,
      String financialStatus,
      String sourceFingerprint,
      List<ChecklistView> checklist,
      List<SnapshotView> snapshots,
      List<String> blockers,
      List<CompletionEvent> completionHistory) {}
}
