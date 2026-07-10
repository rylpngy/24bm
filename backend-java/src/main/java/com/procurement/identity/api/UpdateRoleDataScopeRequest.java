package com.procurement.identity.api;

import jakarta.validation.constraints.NotBlank;

// 设置角色数据范围(行级权限):all=全部数据;department=仅本部门。
public record UpdateRoleDataScopeRequest(@NotBlank String dataScope) {}
