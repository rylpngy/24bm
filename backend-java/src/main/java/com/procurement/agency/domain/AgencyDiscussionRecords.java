package com.procurement.agency.domain;

import com.procurement.agency.domain.AgencyAssessmentRecords.Subject;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyDiscussionRecords {
  private AgencyDiscussionRecords() {}

  @Schema(name = "AgencyDiscussionPlan")
  public record Plan(
      String tenantId,
      String sessionId,
      String packageId,
      String mode,
      long version,
      String subjectsJson,
      String basisJson,
      String frozenHash,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "AgencyDiscussionActivate")
  public record Activate(
      Long expectedVersion,
      String evidenceVersionId,
      boolean reviewed,
      String reason,
      String idempotencyKey) {}

  @Schema(name = "AgencyDiscussionContent")
  public record Content(
      OffsetDateTime startedAt,
      OffsetDateTime endedAt,
      List<String> staffUserIds,
      String supplierAttendees,
      String agenda,
      String discussion,
      String supplierResponse,
      String conclusion,
      String changeDisposition,
      String changeNote,
      String evidenceVersionId) {}

  @Schema(name = "AgencySupplierDiscussion")
  public record Row(
      String id,
      String tenantId,
      String sessionId,
      String participationId,
      int ordinal,
      String previousId,
      String status,
      long version,
      String contentJson,
      String frozenJson,
      String frozenHash,
      String createdBy,
      OffsetDateTime createdAt,
      String confirmedBy,
      OffsetDateTime confirmedAt,
      String voidReason) {}

  @Schema(name = "AgencyDiscussionSave")
  public record Save(
      String recordId,
      Long expectedVersion,
      Content content,
      String reason,
      String idempotencyKey) {}

  @Schema(name = "AgencyDiscussionConfirm")
  public record Confirm(
      Long expectedVersion,
      String expectedPreviousId,
      String supplierConfirmationVersionId,
      String supplierConfirmationNote,
      boolean reviewed,
      String idempotencyKey,
      String expectedFingerprint) {}

  @Schema(name = "AgencyDiscussionVoid")
  public record VoidDraft(Long expectedVersion, String reason, String idempotencyKey) {}

  @Schema(name = "AgencyDiscussionReference")
  public record Reference(
      String participationId, String recordId, int ordinal, String frozenHash) {}

  @Schema(name = "AgencyDiscussionProgress")
  public record Progress(
      String participationId,
      String supplierName,
      int confirmedCount,
      boolean hasDraft,
      boolean changePending,
      Reference latest) {}

  @Schema(name = "AgencyDiscussionWorkspace")
  public record Workspace(
      Plan plan,
      String mode,
      String fingerprint,
      List<Subject> candidates,
      List<Progress> progress,
      List<String> blockers,
      OffsetDateTime openedAt) {}

  @Schema(name = "AgencyDiscussionLedger")
  public record Ledger(Subject subject, List<Row> records, List<String> blockers) {}

  public record Gate(String mode, String fingerprint, List<String> blockers) {}
}
