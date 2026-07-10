package com.procurement.workflow.api;

import jakarta.validation.constraints.NotNull;

public record CompleteApprovalRequest(
    @NotNull Boolean approved,
    String comment) {
}
