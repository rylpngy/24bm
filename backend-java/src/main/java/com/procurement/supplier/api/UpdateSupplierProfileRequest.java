package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;

public record UpdateSupplierProfileRequest(
    @NotBlank String name,
    @NotBlank String industry,
    @NotBlank String creditCode,
    @NotBlank String legalPerson) {
}
