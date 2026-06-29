package com.procurement.identity.api;

import java.util.List;

// 当前登录用户的有效权限点(展平其所有激活角色的 permissions)。前端据此做菜单/路由门禁。
public record MyPermissionsResponse(List<String> permissions) {}
