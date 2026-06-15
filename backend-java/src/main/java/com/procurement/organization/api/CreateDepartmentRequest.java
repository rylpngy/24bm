package com.procurement.organization.api;

import jakarta.validation.constraints.NotBlank;

public record CreateDepartmentRequest(
    @NotBlank String name,
    String parentId) {
}
