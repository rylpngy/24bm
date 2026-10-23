package com.procurement.supplier.api;

import java.time.OffsetDateTime;

public record QualificationReviewResponse(
    long id, String relationId, String qualificationId, String previousId,
    String qualificationType, String supplierName, String tenantName, String status, String comment,
    String actorId, OffsetDateTime createdAt, OffsetDateTime reviewedAt) {}
