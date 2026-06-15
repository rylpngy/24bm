package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record CreateSupplierQualificationRequest(
    @NotBlank String qualificationType,
    String certificateNo,
    LocalDate expiresAt,
    @NotBlank String fileName,
    @NotBlank String storageKey) {
}
