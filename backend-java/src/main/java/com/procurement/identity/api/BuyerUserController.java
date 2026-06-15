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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/users")
public class BuyerUserController {
  private final BuyerUserApplicationService buyerUserApplicationService;

  public BuyerUserController(BuyerUserApplicationService buyerUserApplicationService) {
    this.buyerUserApplicationService = buyerUserApplicationService;
  }

  @GetMapping
  public ApiResponse<List<BuyerUserResponse>> list() {
    return ApiResponse.ok(buyerUserApplicationService.listCurrentTenantUsers());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<BuyerUserResponse> create(@Valid @RequestBody CreateBuyerUserRequest request) {
    return ApiResponse.ok(buyerUserApplicationService.createUser(request));
  }

  @PostMapping("/{userId}/role")
  public ApiResponse<BuyerUserResponse> changeRole(
      @PathVariable String userId,
      @Valid @RequestBody ChangeBuyerUserRoleRequest request) {
    return ApiResponse.ok(buyerUserApplicationService.changeUserRole(userId, request));
  }
}
