package com.procurement.identity.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreateBuyerUserRequest(
    @NotBlank String name,
    String mobile,
    @Email String email,
    @NotBlank String status,
    @NotBlank String departmentId) {
}
