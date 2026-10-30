package com.procurement.workflow.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;

public record WorkflowTaskOperationRequest(
    @NotBlank String action,
    @Size(max = 20) List<@NotBlank String> recipientIds,
    @NotBlank @Size(max = 1000) String reason,
    OffsetDateTime dueAt) {
}
