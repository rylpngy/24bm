package com.procurement.audit.domain;

import java.time.OffsetDateTime;

public record AuditLog(
    String id,
    String tenantId,
    String actorId,
    String action,
    String targetType,
    String targetId,
    OffsetDateTime createdAt) {
}
