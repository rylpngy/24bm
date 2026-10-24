package com.procurement.mall.domain;

import java.time.OffsetDateTime;

public record MallAfterSalesEvent(
    String id, String afterSalesId, String actorId, String actorRole,
    String fromStatus, String toStatus, String note, String evidenceNo, OffsetDateTime createdAt) {}
