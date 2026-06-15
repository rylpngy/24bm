package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;

public record ChangeSupplierQualificationStatusRequest(@NotBlank String status) {
}
