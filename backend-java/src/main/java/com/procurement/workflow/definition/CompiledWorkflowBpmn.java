package com.procurement.workflow.definition;

public record CompiledWorkflowBpmn(
    String processKey,
    byte[] bpmnXml) {
}
