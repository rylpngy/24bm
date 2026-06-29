package com.procurement.identity.api;

import jakarta.validation.constraints.NotNull;
import java.util.List;

// 更新角色权限:整组覆盖(目录内权限点的子集)。
public record UpdateRolePermissionsRequest(@NotNull List<String> permissions) {}
