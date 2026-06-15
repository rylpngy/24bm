package com.procurement.platform.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record UpdateTenantPlanRequest(
    @NotBlank String plan,
    @NotNull @Positive Integer userLimit) {
}
