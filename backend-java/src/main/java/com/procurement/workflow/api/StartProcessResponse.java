package com.procurement.workflow.api;

public record StartProcessResponse(
    String processInstanceId,
    String demandId,
    boolean ended) {
}
