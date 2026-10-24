package com.procurement.workflow.domain;

import java.util.List;

public record WorkflowLedgerQuery(String tenantId, String view, String userId, boolean restricted,
    List<String> departmentIds, String requesterId, String keyword) {}
