package com.procurement.workflow.api;

public record StartProcessResponse(
    String processInstanceId,
    String bizType,
    String bizId,
    boolean ended) {
}
