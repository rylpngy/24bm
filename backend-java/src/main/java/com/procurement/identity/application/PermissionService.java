package com.procurement.identity.application;

import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.infrastructure.PermissionMapper;
import java.util.List;
import org.springframework.stereotype.Service;

// 细粒度 RBAC:解析当前用户的角色权限并按需校验。支持通配:
// 授予 "buyer:*" 覆盖 "buyer:**";授予 "buyer:payment:*" 覆盖 "buyer:payment:register"。
@Service
public class PermissionService {
  private final PermissionMapper permissionMapper;

  public PermissionService(PermissionMapper permissionMapper) {
    this.permissionMapper = permissionMapper;
  }

  public boolean currentUserHas(String required) {
    return userHas(TenantContext.userId(), required);
  }

  public boolean userHas(String userId, String required) {
    if (userId == null) {
      return false;
    }
    List<String> granted = permissionMapper.listUserPermissions(userId);
    return granted != null && granted.stream().anyMatch(g -> matches(g, required));
  }

  // 当前用户的有效权限点(展平所有激活角色,去重)。供前端菜单/路由门禁。
  public List<String> currentUserPermissions() {
    String userId = TenantContext.userId();
    if (userId == null) {
      return List.of();
    }
    List<String> granted = permissionMapper.listUserPermissions(userId);
    return granted == null ? List.of() : granted;
  }

  // 在敏感操作入口调用:权限不足抛 403。
  public void require(String required) {
    if (!currentUserHas(required)) {
      throw new PermissionDeniedException("缺少所需权限:" + required);
    }
  }

  // 授予项 g 是否覆盖所需权限 required(精确或前缀通配 "...:*")。
  private static boolean matches(String granted, String required) {
    if (granted == null) {
      return false;
    }
    if (granted.equals(required)) {
      return true;
    }
    if (granted.endsWith(":*")) {
      String prefix = granted.substring(0, granted.length() - 1); // 保留末尾 ":"
      return required.startsWith(prefix);
    }
    return false;
  }
}
