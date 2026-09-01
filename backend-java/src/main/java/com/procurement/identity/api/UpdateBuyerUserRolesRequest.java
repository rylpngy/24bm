package com.procurement.identity.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record UpdateBuyerUserRolesRequest(
    @NotEmpty List<@NotBlank String> roleIds) {
}
