package com.procurement.agency.domain;

import com.procurement.agency.domain.AgencyAssessmentRecords.Entry;
import com.procurement.agency.domain.AgencyEvaluationRecords.MemberSnapshot;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyFinalResponseRecords {
  private AgencyFinalResponseRecords() {}

  @Schema(name = "AgencyFinalResponseClause")
  public record Clause(
      String key,
      String title,
      String locator,
      String requirementText,
      String sourceVersionId,
      String sourceHash) {}

  @Schema(name = "AgencyFinalResponseSubject")
  public record Subject(
      String participationId,
      String supplierName,
      String receiptId,
      String fileVersionId,
      String attachmentId,
      String responseHash) {}

  @Schema(name = "AgencyFinalResponseSnapshot")
  public record Snapshot(
      String sessionId,
      String roundHash,
      String campaignId,
      String campaignHash,
      String requirementsVersionId,
      String requirementsHash,
      String changesJson,
      List<Subject> subjects,
      List<Clause> clauses,
      List<com.procurement.agency.domain.AgencyEvaluationRecords.Criterion> criteria,
      List<MemberSnapshot> members,
      String evidenceVersionId,
      String evidenceHash,
      String reason,
      String actorId) {}

  @Schema(name = "AgencyFinalResponsePlan")
  public record Plan(
      String tenantId,
      String sessionId,
      String packageId,
      String mode,
      long version,
      String snapshotJson,
      String frozenHash,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "AgencyFinalResponseSheet")
  public record Sheet(
      String id,
      String tenantId,
      String sessionId,
      String userId,
      String status,
      long version,
      String entriesJson,
      String snapshotJson,
      String frozenHash,
      OffsetDateTime submittedAt,
      OffsetDateTime updatedAt,
      int ordinal,
      String previousId,
      String correctionId) {}

  @Schema(name = "AgencyFinalResponseActivate")
  public record Activate(
      Long expectedVersion,
      String expectedFingerprint,
      String evidenceVersionId,
      boolean reviewed,
      String reason,
      String idempotencyKey) {}

  @Schema(name = "AgencyFinalResponseSave")
  public record Save(
      Long expectedVersion,
      String expectedFingerprint,
      List<Entry> entries,
      String idempotencyKey) {}

  @Schema(name = "AgencyFinalResponseSubmit")
  public record Submit(
      Long expectedVersion,
      String expectedFingerprint,
      String evidenceVersionId,
      boolean personallyConfirmed,
      String idempotencyKey) {}

  @Schema(name = "AgencyFinalResponseProgress")
  public record Progress(String userId, String name, String status) {}

  @Schema(name = "AgencyMethodBranch")
  public record Branch(
      String procurementMethod,
      String evaluationMethod,
      String priceSource,
      boolean finalResponseRequired,
      boolean scoringAllowed,
      boolean competitive,
      List<String> remainingProcesses) {}

  @Schema(name = "AgencyFinalResponseWorkspace")
  public record Workspace(
      String mode,
      Branch branch,
      String fingerprint,
      Plan plan,
      Snapshot snapshot,
      List<Progress> progress,
      List<String> blockers) {}

  @Schema(name = "AgencyFinalResponseMine")
  public record Mine(
      String fingerprint,
      Plan plan,
      Snapshot snapshot,
      Sheet sheet,
      List<String> blockers,
      List<Sheet> history,
      List<com.procurement.agency.domain.AgencyAssessmentRecords.Correction> corrections) {}

  @Schema(name = "AgencyFinalResponseCorrectionDraft")
  public record CorrectionDraft(
      Long expectedVersion,
      String expectedFingerprint,
      List<com.procurement.agency.domain.AgencyAssessmentRecords.Cell> cells,
      String reason,
      String evidenceVersionId,
      Map<String, Object> formData,
      String idempotencyKey) {}

  public record Gate(boolean legacy, Set<String> failed, List<String> blockers, String marker) {}
}
