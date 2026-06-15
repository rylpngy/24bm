package com.procurement.identity.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.identity.application.BuyerRoleApplicationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
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
}
