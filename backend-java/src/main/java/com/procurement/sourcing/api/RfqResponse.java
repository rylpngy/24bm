package com.procurement.sourcing.api;

import java.time.OffsetDateTime;
import java.util.List;

public record RfqResponse(
    String id,
    String tenantId,
    String title,
    String status,
    OffsetDateTime deadlineAt,
    String ownerId,
    String awardedSupplierId,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    List<String> demandIds,
    List<String> invitedSupplierIds) {
}
