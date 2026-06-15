package com.procurement.platform.api;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CreateTenantRequest(
    @NotBlank String tenantId,
    @NotBlank String enterpriseId,
    @NotBlank String name,
    @NotBlank String industry,
    @NotBlank String plan,
    @Min(1) Integer userLimit,
    @NotNull List<String> enabledFeatures,
    @NotBlank String adminName,
    String adminMobile,
    @NotBlank String adminEmail,
    @NotBlank String adminPassword) {
}
