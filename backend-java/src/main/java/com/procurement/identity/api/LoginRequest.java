package com.procurement.identity.api;

import com.procurement.identity.domain.IdentityScope;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record LoginRequest(
    @NotBlank String account,
    @NotBlank String password,
    @NotNull IdentityScope scope,
    String tenantId,
    String supplierId) {
}
