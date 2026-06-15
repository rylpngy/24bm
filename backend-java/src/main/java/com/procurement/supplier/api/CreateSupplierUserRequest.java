package com.procurement.supplier.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreateSupplierUserRequest(
    @NotBlank String name,
    String mobile,
    @Email String email,
    @NotBlank String status,
    @NotBlank String initialPassword) {
}
