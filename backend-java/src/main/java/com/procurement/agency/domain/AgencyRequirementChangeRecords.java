package com.procurement.agency.domain;

import com.procurement.agency.domain.AgencyAssessmentRecords.Subject;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyRequirementChangeRecords {
  private AgencyRequirementChangeRecords() {}

  @Schema(name = "AgencyRequirementChange")
  public record Change(
      String id,
      String tenantId,
      String sessionId,
      String packageId,
      int ordinal,
      String status,
      long version,
      String snapshotJson,
      String frozenHash,
      String completionJson,
      String completionHash,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "AgencyRequirementNoticeReceipt")
  public record Receipt(
      String id,
      String tenantId,
      String changeId,
      String participationId,
      int ordinal,
      String previousId,
      String snapshotJson,
      String frozenHash,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "AgencyRequirementChangeCreate")
  public record Create(
      String expectedFingerprint,
      String kind,
      String locator,
      String beforeText,
      String afterText,
      String authorityName,
      String authorityRole,
      String authorityScope,
      String authorizationVersionId,
      OffsetDateTime authorizedAt,
      String requirementsVersionId,
      String noticeVersionId,
      OffsetDateTime sentAt,
      String channel,
      OffsetDateTime responseDeadlineAt,
      boolean limitsReviewed,
      boolean publicContentReviewed,
      boolean adequateTimeReviewed,
      String reason,
      String idempotencyKey) {}

  @Schema(name = "AgencyRequirementReceiptRegister")
  public record Register(
      String expectedFingerprint,
      String participationId,
      String expectedPreviousId,
      OffsetDateTime receivedAt,
      String recipient,
      String evidenceVersionId,
      String note,
      String replacementReason,
      boolean contentChecked,
      String idempotencyKey) {}

  @Schema(name = "AgencyRequirementChangeComplete")
  public record Complete(
      String expectedFingerprint,
      boolean reviewed,
      String evidenceVersionId,
      String note,
      String idempotencyKey) {}

  @Schema(name = "AgencyRequirementChangeSnapshot")
  public record Snapshot(
      String sessionId,
      String roundHash,
      String planHash,
      int ordinal,
      String previousHash,
      List<com.procurement.agency.domain.AgencyDiscussionRecords.Reference> sourceRecords,
      List<Subject> subjects,
      Create content,
      Map<String, String> evidenceHashes,
      String actorId) {}

  @Schema(name = "AgencyRequirementReceiptSnapshot")
  public record ReceiptSnapshot(
      String changeHash,
      String participationId,
      String supplierName,
      int ordinal,
      String previousHash,
      Register content,
      String evidenceHash,
      String actorId) {}

  @Schema(name = "AgencyRequirementChangeCompletion")
  public record Completion(
      String changeHash,
      List<Reference> receipts,
      String evidenceVersionId,
      String evidenceHash,
      String note,
      OffsetDateTime effectiveAt,
      String actorId) {}

  @Schema(name = "AgencyRequirementChangeReference")
  public record Reference(String id, String hash) {}

  @Schema(name = "AgencyRequirementChangeWorkspace")
  public record Workspace(
      String fingerprint,
      List<Change> changes,
      List<Receipt> receipts,
      List<com.procurement.agency.domain.AgencyDiscussionRecords.Reference> pendingSources,
      List<Subject> subjects,
      List<String> blockers) {}

  public record Gate(
      Set<String> covered, List<String> blockers, String fingerprint, List<Change> changes) {}
}
