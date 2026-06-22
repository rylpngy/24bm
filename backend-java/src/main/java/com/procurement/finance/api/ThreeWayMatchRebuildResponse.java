package com.procurement.finance.api;

public record ThreeWayMatchRebuildResponse(
    String tenantId,
    int rebuiltCount) {
}
