package com.procurement.workflow.application;

public record WorkflowCompletion(
    boolean approved,
    String actorId,
    String comment) {
}
