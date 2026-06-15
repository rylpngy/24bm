package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;

public record ChangeSupplierUserStatusRequest(@NotBlank String status) {
}
