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
    OffsetDateTime createdAt,
    // E-1 有效期提醒:长期有效 / 有效 / 临期 / 已过期;daysToExpiry 已过期为负,无到期日为 null。
    String expiryState,
    Long daysToExpiry) {
}
