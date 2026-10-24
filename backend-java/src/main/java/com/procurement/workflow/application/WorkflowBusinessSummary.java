package com.procurement.workflow.application;

import java.time.OffsetDateTime;

/** Minimal authorized workflow metadata for other application modules. */
public record WorkflowBusinessSummary(
    String id,
    String status,
    String initiatorName,
    OffsetDateTime createdAt,
    String completedByName,
    OffsetDateTime completedAt) {}
