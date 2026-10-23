package com.procurement.supplier.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateSupplierUserRequest(
    @NotBlank @Size(max = 100) String name,
    @Size(max = 30) String mobile,
    @Email @Size(max = 254) String email,
    @NotBlank String status,
    @NotBlank @Size(min = 6, max = 72) String initialPassword) {
}
