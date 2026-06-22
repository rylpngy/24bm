package com.procurement.contract.domain;

import java.time.OffsetDateTime;

public record ContractFulfillmentEvent(
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
