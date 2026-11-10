package com.procurement.agency.domain;

import java.time.OffsetDateTime;
import java.util.*;

public final class AgencyOfficeEditRecords {
  public record Session(
      String id,
      String tenantId,
      String packageId,
      String documentId,
      String sourceRevisionId,
      String sourceFileVersionId,
      String sourceHash,
      long baseVersion,
      String basisHash,
      String documentKey,
      String sourceTicketHash,
      String state,
      long version,
      OffsetDateTime expiresAt,
      String lastError,
      String adoptedRevisionId,
      String createdBy,
      OffsetDateTime createdAt) {}

  public record Save(
      String id,
      String tenantId,
      String sessionId,
      int ordinal,
      String fileVersionId,
      String fileHash,
      String callbackHash,
      int callbackStatus,
      OffsetDateTime createdAt) {}

  public record SessionView(
      String id,
      String state,
      long version,
      String sourceRevisionId,
      String sourceHash,
      long baseVersion,
      OffsetDateTime expiresAt,
      String lastError,
      String adoptedRevisionId,
      String createdBy,
      List<Save> saves) {}

  public record Workspace(boolean configured, String scriptUrl, List<SessionView> sessions) {}

  public record Start(
      Long expectedVersion,
      String sourceRevisionId,
      boolean reviewed,
      String reason,
      String idempotencyKey) {}

  public record Open(SessionView session, String scriptUrl, Map<String, Object> config) {}

  public record Command(
      Long expectedVersion,
      String saveId,
      boolean reviewed,
      String reason,
      String idempotencyKey) {}
}
