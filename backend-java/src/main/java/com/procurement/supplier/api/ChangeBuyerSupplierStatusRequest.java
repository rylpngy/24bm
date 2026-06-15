package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;

public record ChangeBuyerSupplierStatusRequest(@NotBlank String status) {
}
