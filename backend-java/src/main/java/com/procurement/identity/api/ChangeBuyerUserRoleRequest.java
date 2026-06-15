package com.procurement.identity.api;

import jakarta.validation.constraints.NotBlank;

public record ChangeBuyerUserRoleRequest(@NotBlank String roleId) {
}
