package com.procurement.buyer.api;

import com.procurement.buyer.application.BuyerAnalyticsApplicationService;
import com.procurement.common.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/analytics")
public class BuyerAnalyticsController {
  private final BuyerAnalyticsApplicationService buyerAnalyticsApplicationService;

  public BuyerAnalyticsController(
      BuyerAnalyticsApplicationService buyerAnalyticsApplicationService) {
    this.buyerAnalyticsApplicationService = buyerAnalyticsApplicationService;
  }

  @GetMapping("/procurement")
  public ApiResponse<ProcurementAnalyticsResponse> procurement() {
    return ApiResponse.ok(buyerAnalyticsApplicationService.procurementAnalytics());
  }
}
