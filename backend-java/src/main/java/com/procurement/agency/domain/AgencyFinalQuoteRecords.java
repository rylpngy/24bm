package com.procurement.agency.domain;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.procurement.agency.domain.AgencyAssessmentRecords.Subject;
import com.procurement.agency.domain.AgencyRecords.FileView;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyFinalQuoteRecords {
  private AgencyFinalQuoteRecords() {}

  @Schema(name = "AgencyFinalQuoteCampaign")
  public record Campaign(
      String id,
      String tenantId,
      String sessionId,
      String packageId,
      String status,
      long version,
      OffsetDateTime cutoffAt,
      OffsetDateTime initiatedAt,
      String subjectsJson,
      String scopeHash,
      String exclusionsJson,
      String requirementsVersionId,
      String requirementsHash,
      String noticeVersionId,
      String noticeHash,
      String reason,
      String createdBy,
      OffsetDateTime createdAt,
      OffsetDateTime confirmedAt,
      String confirmationVersionId,
      String confirmationHash,
      String decisionsJson,
      String confirmationNote,
      String discussionManifestJson,
      String discussionFingerprint,
      String requirementChangesJson) {}

  @Schema(name = "AgencyFinalQuoteStart")
  public record Start(
      List<String> participationIds,
      Map<String, String> exclusions,
      OffsetDateTime cutoffAt,
      OffsetDateTime initiatedAt,
      String requirementsVersionId,
      String noticeVersionId,
      boolean reviewed,
      String reason,
      String idempotencyKey,
      @com.fasterxml.jackson.annotation.JsonInclude(
              com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
          String discussionFingerprint) {}

  @Schema(name = "AgencyFinalQuoteReceipt")
  public record Receipt(
      String id,
      String tenantId,
      String campaignId,
      String participationId,
      String fileId,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal amount,
      String currency,
      OffsetDateTime receivedAt,
      String originalType,
      String sourceNote,
      String lateEntryReason,
      String status,
      String withdrawReason,
      String createdBy,
      OffsetDateTime createdAt) {}

  @Schema(name = "AgencyFinalQuoteReceive")
  public record Receive(
      String participationId,
      String fileName,
      BigDecimal amount,
      String currency,
      OffsetDateTime receivedAt,
      String originalType,
      String sourceNote,
      String lateEntryReason,
      String idempotencyKey) {}

  @Schema(name = "AgencyFinalQuoteReceiptView")
  public record ReceiptView(Receipt receipt, FileView file) {}

  @Schema(name = "AgencyFinalQuoteDecision")
  public record Decision(String participationId, String receiptId, String status, String reason) {}

  @Schema(name = "AgencyFinalQuoteResult")
  public record Result(
      String participationId,
      String receiptId,
      String status,
      String reason,
      String fileVersionId,
      String hash,
      @JsonFormat(shape = JsonFormat.Shape.STRING) @Schema(type = "string") BigDecimal amount,
      String currency) {}

  @Schema(name = "AgencyFinalQuoteConfirm")
  public record Confirm(
      Long expectedVersion,
      String receiptFingerprint,
      List<Decision> decisions,
      String evidenceVersionId,
      boolean reviewed,
      String note,
      String idempotencyKey) {}

  @Schema(name = "AgencyFinalQuoteWithdraw")
  public record Withdraw(
      Long expectedVersion,
      String reason,
      String idempotencyKey,
      @com.fasterxml.jackson.annotation.JsonInclude(
              com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
          String discussionFingerprint) {}

  @Schema(name = "AgencyFinalQuoteWorkspace")
  public record Workspace(
      Campaign campaign,
      List<Subject> candidates,
      List<Subject> subjects,
      List<ReceiptView> receipts,
      List<Result> results,
      String receiptFingerprint,
      List<String> blockers,
      String discussionMode,
      String discussionFingerprint,
      List<String> discussionBlockers) {}
}
