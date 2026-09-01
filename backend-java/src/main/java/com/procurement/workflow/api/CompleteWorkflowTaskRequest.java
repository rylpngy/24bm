package com.procurement.workflow.api;

import jakarta.validation.constraints.NotBlank;

public record CompleteWorkflowTaskRequest(
    @NotBlank String action,
    String comment) {
}
