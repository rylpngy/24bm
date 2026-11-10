package com.procurement.agency.domain;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyIncidentRecords {
  private AgencyIncidentRecords() {}

  @Schema(name = "AgencyEvaluationControl")
  public record Control(
      String tenantId,
      String roundId,
      String packageId,
      String state,
      long version,
      String updatedBy,
      OffsetDateTime updatedAt) {}

  @Schema(name = "AgencyEvaluationIncident")
  public record Incident(
      String id,
      String tenantId,
      String roundId,
      String packageId,
      String kind,
      String title,
      OffsetDateTime occurredAt,
      String responsibleId,
      String responsibleName,
      String impactScope,
      String description,
      String evidenceVersionId,
      String evidenceHash,
      String effect,
      String restorationConditions,
      String status,
      long version,
      String createdBy,
      OffsetDateTime createdAt,
      String resolutionJson,
      String resolvedBy,
      OffsetDateTime resolvedAt) {}

  @Schema(name = "AgencyIncidentCreate")
  public record Create(
      String kind,
      String title,
      OffsetDateTime occurredAt,
      String responsibleId,
      String impactScope,
      String description,
      String evidenceVersionId,
      String effect,
      String restorationConditions,
      boolean reviewed,
      String idempotencyKey) {}

  @Schema(name = "AgencyIncidentResolution")
  public record Resolution(
      Long expectedVersion,
      OffsetDateTime handledAt,
      String outcome,
      String evidenceVersionId,
      boolean conditionsChecked,
      String note,
      String idempotencyKey) {}

  @Schema(name = "AgencyIncidentResolutionSnapshot")
  public record ResolutionSnapshot(
      OffsetDateTime handledAt,
      String outcome,
      String evidenceVersionId,
      String evidenceHash,
      String note) {}

  @Schema(name = "AgencyEvaluationControlCommand")
  public record Command(
      Long expectedVersion,
      String casesFingerprint,
      String evidenceVersionId,
      boolean reviewed,
      String reason,
      String idempotencyKey) {}

  @Schema(name = "AgencyEvaluationControlEvent")
  public record Event(
      String id,
      String tenantId,
      String roundId,
      long controlVersion,
      String action,
      String beforeState,
      String afterState,
      String incidentId,
      String casesFingerprint,
      String evidenceVersionId,
      String evidenceHash,
      String reason,
      String actorId,
      OffsetDateTime createdAt) {}

  @Schema(name = "AgencyEvaluationControlStatus")
  public record Status(String state, long version, int openCount, List<String> blockers) {}

  @Schema(name = "AgencyIncidentWorkspace")
  public record Workspace(
      Control control,
      String casesFingerprint,
      List<Incident> incidents,
      List<Event> events,
      List<String> resumeBlockers) {}
}
