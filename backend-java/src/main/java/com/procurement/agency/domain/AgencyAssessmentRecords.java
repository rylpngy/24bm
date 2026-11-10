package com.procurement.agency.domain;

import com.procurement.agency.domain.AgencyEvaluationRecords.Criterion;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyAssessmentRecords {
  private AgencyAssessmentRecords() {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyAssessmentSubject")
  public record Subject(String participationId, String supplierName) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyAssessmentCell")
  public record Cell(String participationId, String criterionKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyAssessmentEntry")
  public record Entry(
      String participationId,
      String criterionKey,
      BigDecimal score,
      String conclusion,
      String evidence,
      String opinion) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyAssessmentStart")
  public record Start(
      Long expectedRoundVersion,
      List<String> participationIds,
      String openingEvidenceVersionId,
      OffsetDateTime openedAt,
      boolean openingReviewed,
      String note,
      String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyAssessmentSession")
  public record Session(
      String id,
      String tenantId,
      String packageId,
      String roundId,
      String roundHash,
      String subjectsJson,
      String openingEvidenceVersionId,
      String openingHash,
      OffsetDateTime openedAt,
      String note,
      String createdBy,
      OffsetDateTime createdAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyAssessmentSheet")
  public record Sheet(
      String id,
      String tenantId,
      String sessionId,
      String userId,
      String stageKey,
      int ordinal,
      String status,
      String entriesJson,
      long version,
      String previousId,
      String correctionId,
      String contentHash,
      OffsetDateTime submittedAt,
      OffsetDateTime updatedAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyAssessmentSheetSave")
  public record SheetSave(Long expectedVersion, List<Entry> entries, String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyAssessmentSubmit")
  public record Submit(Long expectedVersion, boolean personallyConfirmed, String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyAssessmentCorrectionDraft")
  public record CorrectionDraft(
      Long expectedVersion,
      List<Cell> cells,
      String reason,
      String evidenceVersionId,
      Map<String, Object> formData,
      String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyAssessmentCorrection")
  public record Correction(
      String id,
      String tenantId,
      String sessionId,
      String sheetId,
      String userId,
      long sheetVersion,
      String sheetHash,
      String cellsJson,
      String reason,
      String evidenceVersionId,
      String evidenceHash,
      String status,
      String workflowId,
      String resultNote,
      OffsetDateTime createdAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyAssessmentProgress")
  public record Progress(String userId, String name, String status, int ordinal, String stageKey) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyAssessmentMine")
  public record Mine(
      Session session,
      List<String> stageKeys,
      String selectedStage,
      List<Subject> subjects,
      List<Criterion> criteria,
      List<Sheet> sheets,
      List<Correction> corrections,
      boolean writable,
      List<String> blockers) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyAssessmentOverview")
  public record Overview(List<Session> sessions, List<Map<String, String>> availableSubjects) {}
}
