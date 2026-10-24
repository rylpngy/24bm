package com.procurement.workflow.application;

import java.time.OffsetDateTime;

/** Stable cross-module projection; excludes business payloads and attachment bytes. */
public record WorkflowAuditEntry(String workflowInstanceId, String definitionVersionId, String status,
    String initiatorName, OffsetDateTime createdAt, String completedByName, OffsetDateTime completedAt,
    String nodeName, String action, String actorName, OffsetDateTime occurredAt, String comment) {}
