package com.procurement.contract.api;

import java.time.OffsetDateTime;

public record ContractFulfillmentEventResponse(
    String id,
    String tenantId,
    String contractId,
    String actionType,
    String targetId,
    String summary,
    String sourceLabel,
    String createdBy,
    OffsetDateTime createdAt) {
}
