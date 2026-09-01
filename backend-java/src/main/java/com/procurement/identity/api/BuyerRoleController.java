package com.procurement.identity.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.identity.application.BuyerRoleApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
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

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<BuyerRoleResponse> create(@Valid @RequestBody CreateBuyerRoleRequest request) {
    return ApiResponse.ok(buyerRoleApplicationService.createRole(request));
  }

  @PutMapping("/{roleId}")
  public ApiResponse<BuyerRoleResponse> update(
      @PathVariable String roleId,
      @Valid @RequestBody UpdateBuyerRoleRequest request) {
    return ApiResponse.ok(buyerRoleApplicationService.updateRole(roleId, request));
  }

  @DeleteMapping("/{roleId}")
  public ApiResponse<Void> delete(@PathVariable String roleId) {
    buyerRoleApplicationService.deleteRole(roleId);
    return ApiResponse.ok(null);
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

  @PostMapping("/{roleId}/data-scope")
  public ApiResponse<BuyerRoleResponse> updateDataScope(
      @PathVariable String roleId, @Valid @RequestBody UpdateRoleDataScopeRequest request) {
    return ApiResponse.ok(buyerRoleApplicationService.updateRoleDataScope(roleId, request));
  }
}
