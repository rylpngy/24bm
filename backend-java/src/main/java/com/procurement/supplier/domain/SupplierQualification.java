package com.procurement.supplier.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record SupplierQualification(
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
