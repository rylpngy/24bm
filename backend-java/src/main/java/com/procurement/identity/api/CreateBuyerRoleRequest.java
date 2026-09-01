package com.procurement.identity.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** 新建采购方自定义角色。 */
public record CreateBuyerRoleRequest(
    @NotBlank @Size(max = 50) String name,
    @NotNull List<String> permissions,
    @NotBlank String dataScope) {}
