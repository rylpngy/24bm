package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.SupplierUserApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/users")
public class SupplierUserController {
  private final SupplierUserApplicationService supplierUserApplicationService;

  public SupplierUserController(SupplierUserApplicationService supplierUserApplicationService) {
    this.supplierUserApplicationService = supplierUserApplicationService;
  }

  @GetMapping
  public ApiResponse<List<SupplierUserResponse>> list() {
    return ApiResponse.ok(supplierUserApplicationService.listCurrentSupplierUsers());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<SupplierUserResponse> create(@Valid @RequestBody CreateSupplierUserRequest request) {
    return ApiResponse.ok(supplierUserApplicationService.createCurrentSupplierUser(request));
  }

  @PostMapping("/{userId}/password")
  public ApiResponse<SupplierUserResponse> resetPassword(
      @PathVariable String userId,
      @Valid @RequestBody ResetSupplierUserPasswordRequest request) {
    return ApiResponse.ok(supplierUserApplicationService.resetUserPassword(userId, request));
  }

  @PostMapping("/{userId}/status")
  public ApiResponse<SupplierUserResponse> changeStatus(
      @PathVariable String userId,
      @Valid @RequestBody ChangeSupplierUserStatusRequest request) {
    return ApiResponse.ok(supplierUserApplicationService.changeUserStatus(userId, request));
  }
}
