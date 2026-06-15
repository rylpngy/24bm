package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;

public record ResetSupplierUserPasswordRequest(@NotBlank String newPassword) {
}
