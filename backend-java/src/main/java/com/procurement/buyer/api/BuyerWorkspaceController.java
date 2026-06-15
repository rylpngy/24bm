package com.procurement.buyer.api;

import com.procurement.buyer.application.BuyerWorkspaceApplicationService;
import com.procurement.common.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/workspace")
public class BuyerWorkspaceController {
  private final BuyerWorkspaceApplicationService buyerWorkspaceApplicationService;

  public BuyerWorkspaceController(BuyerWorkspaceApplicationService buyerWorkspaceApplicationService) {
    this.buyerWorkspaceApplicationService = buyerWorkspaceApplicationService;
  }

  @GetMapping
  public ApiResponse<BuyerWorkspaceResponse> load() {
    return ApiResponse.ok(buyerWorkspaceApplicationService.load());
  }
}
