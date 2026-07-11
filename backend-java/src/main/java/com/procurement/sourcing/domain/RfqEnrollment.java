package com.procurement.sourcing.domain;

import java.time.OffsetDateTime;

public record RfqEnrollment(
    String id,
    String tenantId,
    String rfqId,
    String companyName,
    String contactName,
    String contactPhone,
    String note,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
