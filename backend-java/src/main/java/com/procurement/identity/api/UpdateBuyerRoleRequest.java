package com.procurement.identity.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** 更新采购方角色的名称、功能权限和数据范围。 */
public record UpdateBuyerRoleRequest(
    @NotBlank @Size(max = 50) String name,
    @NotNull List<String> permissions,
    @NotBlank String dataScope) {}
