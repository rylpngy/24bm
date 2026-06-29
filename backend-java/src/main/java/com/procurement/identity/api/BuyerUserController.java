package com.procurement.identity.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.identity.application.BuyerUserApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/users")
public class BuyerUserController {
  private final BuyerUserApplicationService buyerUserApplicationService;
  private final com.procurement.identity.application.BuyerUserImportApplicationService importApplicationService;

  public BuyerUserController(
      BuyerUserApplicationService buyerUserApplicationService,
      com.procurement.identity.application.BuyerUserImportApplicationService importApplicationService) {
    this.buyerUserApplicationService = buyerUserApplicationService;
    this.importApplicationService = importApplicationService;
  }

  @GetMapping
  public ApiResponse<List<BuyerUserResponse>> list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String departmentId,
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(buyerUserApplicationService.listCurrentTenantUsers(status, departmentId, keyword));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<BuyerUserResponse> create(@Valid @RequestBody CreateBuyerUserRequest request) {
    return ApiResponse.ok(buyerUserApplicationService.createUser(request));
  }

  // 批量导入部门成员(CSV 解析后提交);逐行尽力创建,返回成功/失败明细。
  @PostMapping("/import")
  public ApiResponse<ImportBuyerUsersResponse> importUsers(
      @Valid @RequestBody ImportBuyerUsersRequest request) {
    return ApiResponse.ok(importApplicationService.importUsers(request));
  }

  @PostMapping("/{userId}/role")
  public ApiResponse<BuyerUserResponse> changeRole(
      @PathVariable String userId,
      @Valid @RequestBody ChangeBuyerUserRoleRequest request) {
    return ApiResponse.ok(buyerUserApplicationService.changeUserRole(userId, request));
  }

  @PostMapping("/{userId}/password")
  public ApiResponse<BuyerUserResponse> resetPassword(
      @PathVariable String userId,
      @Valid @RequestBody ResetBuyerUserPasswordRequest request) {
    return ApiResponse.ok(buyerUserApplicationService.resetUserPassword(userId, request));
  }

  @PostMapping("/{userId}/status")
  public ApiResponse<BuyerUserResponse> changeStatus(
      @PathVariable String userId,
      @Valid @RequestBody ChangeBuyerUserStatusRequest request) {
    return ApiResponse.ok(buyerUserApplicationService.changeUserStatus(userId, request));
  }
}
