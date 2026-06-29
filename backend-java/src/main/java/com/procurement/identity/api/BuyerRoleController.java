package com.procurement.identity.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.identity.application.BuyerRoleApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/roles")
public class BuyerRoleController {
  private final BuyerRoleApplicationService buyerRoleApplicationService;

  public BuyerRoleController(BuyerRoleApplicationService buyerRoleApplicationService) {
    this.buyerRoleApplicationService = buyerRoleApplicationService;
  }

  @GetMapping
  public ApiResponse<List<BuyerRoleResponse>> list() {
    return ApiResponse.ok(buyerRoleApplicationService.listCurrentTenantRoles());
  }

  @GetMapping("/my-permissions")
  public ApiResponse<MyPermissionsResponse> myPermissions() {
    return ApiResponse.ok(buyerRoleApplicationService.myPermissions());
  }

  @GetMapping("/permission-catalog")
  public ApiResponse<List<PermissionPointResponse>> permissionCatalog() {
    return ApiResponse.ok(buyerRoleApplicationService.permissionCatalog());
  }

  @PostMapping("/{roleId}/permissions")
  public ApiResponse<BuyerRoleResponse> updatePermissions(
      @PathVariable String roleId, @Valid @RequestBody UpdateRolePermissionsRequest request) {
    return ApiResponse.ok(buyerRoleApplicationService.updateRolePermissions(roleId, request));
  }
}
