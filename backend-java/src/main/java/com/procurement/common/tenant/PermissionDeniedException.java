package com.procurement.common.tenant;

// 细粒度权限不足:当前用户的角色权限集不包含所需权限时抛出(映射为 HTTP 403)。
public class PermissionDeniedException extends RuntimeException {
  public PermissionDeniedException(String message) {
    super(message);
  }
}
