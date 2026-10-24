package com.procurement.workflow.api;

import java.util.List;

public record WorkflowBusinessInstancePage(List<WorkflowInstanceLedgerResponse> items, long total, int page, int pageSize) {}
