package com.procurement.identity.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.identity.application.PermissionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SessionPermissionController {
  private final PermissionService permissions;

  public SessionPermissionController(PermissionService permissions) {
    this.permissions = permissions;
  }

  @GetMapping("/api/v1/auth/permissions")
  public ApiResponse<MyPermissionsResponse> current() {
    return ApiResponse.ok(new MyPermissionsResponse(permissions.currentUserPermissions()));
  }
}
