package com.procurement.agency.domain;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyMethodRecords {
  private AgencyMethodRecords() {}

  @Schema(name = "AgencyMethodRecord")
  public record Row(
      String id,
      String tenantId,
      String packageId,
      String roundId,
      String kind,
      int ordinal,
      String previousId,
      String sourceFingerprint,
      String snapshotJson,
      String frozenHash,
      String actorId,
      OffsetDateTime createdAt) {}

  @Schema(name = "AgencyInvitationParticipant")
  public record Invitee(
      String participationId,
      String sourceNote,
      String verificationMode,
      String verificationBasis,
      String selectionBasis,
      OffsetDateTime sentAt,
      OffsetDateTime receivedAt,
      String deliveryStatus,
      String recipient,
      String evidenceVersionId) {}

  @Schema(name = "AgencyInvitationCommand")
  public record Invitation(
      String expectedPreviousHash,
      String selectionMode,
      OffsetDateTime formedAt,
      String formationBasis,
      List<Invitee> participants,
      String evidenceVersionId,
      boolean reviewed,
      String reason,
      String idempotencyKey) {}

  @Schema(name = "AgencyInquiryOfferCheck")
  public record OfferCheck(
      String participationId,
      String quoteLayerId,
      String status,
      String responseLocator,
      String handlingBasis,
      String evidenceVersionId) {}

  @Schema(name = "AgencyInquiryValidityCommand")
  public record Inquiry(
      String expectedPreviousHash,
      List<OfferCheck> offers,
      boolean oneOfferChecked,
      boolean noNegotiationChecked,
      boolean reviewed,
      String reason,
      String idempotencyKey) {}

  @Schema(name = "AgencySingleSourceApplicability")
  public record SingleBasis(
      String expectedPreviousHash,
      String grounds,
      String approvalApplicability,
      String approvalNote,
      String approvalVersionId,
      String publicationApplicability,
      String publicationNote,
      String publicationVersionId,
      String evidenceVersionId,
      boolean reviewed,
      String reason,
      String idempotencyKey) {}

  @Schema(name = "AgencySingleSourceNegotiation")
  public record Negotiation(
      String expectedPreviousHash,
      String participationId,
      List<String> staffUserIds,
      OffsetDateTime beganAt,
      OffsetDateTime endedAt,
      List<String> marketSourceVersionIds,
      String priceReasonability,
      String qualityAssurance,
      @com.fasterxml.jackson.annotation.JsonFormat(
              shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
          BigDecimal agreedAmount,
      String currency,
      String supplierConfirmationNote,
      String evidenceVersionId,
      boolean reviewed,
      String reason,
      String idempotencyKey) {}

  @Schema(name = "AgencyMethodProcedureWorkspace")
  public record Workspace(
      String method,
      List<Row> history,
      List<String> legacyKinds,
      List<com.procurement.agency.domain.AgencyExecutionRecords.Participation> participants,
      List<com.procurement.agency.domain.AgencyAssessmentRecords.Subject> subjects,
      List<String> blockers) {}

  public record Gate(Set<String> failed, List<String> blockers, String marker) {}
}
