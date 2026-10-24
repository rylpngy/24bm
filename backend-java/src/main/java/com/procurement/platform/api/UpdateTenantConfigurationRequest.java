package com.procurement.platform.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

public record UpdateTenantConfigurationRequest(
    @NotBlank String plan, @NotNull @Positive Integer userLimit,
    @NotNull List<String> enabledFeatures) {}
