package com.procurement.supplier.api;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record SupplierQualificationResponse(
    String id,
    String supplierId,
    String qualificationType,
    String certificateNo,
    LocalDate expiresAt,
    String fileName,
    String storageKey,
    String status,
    OffsetDateTime createdAt) {
}
