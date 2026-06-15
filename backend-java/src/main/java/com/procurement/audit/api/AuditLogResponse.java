package com.procurement.audit.api;

import java.time.OffsetDateTime;

public record AuditLogResponse(
    String id,
    String tenantId,
    String actorId,
    String action,
    String targetType,
    String targetId,
    OffsetDateTime createdAt) {
}
