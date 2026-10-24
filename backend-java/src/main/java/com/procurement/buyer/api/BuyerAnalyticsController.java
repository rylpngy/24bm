package com.procurement.buyer.api;

import com.procurement.buyer.application.BuyerAnalyticsApplicationService;
import com.procurement.common.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/buyer/analytics")
public class BuyerAnalyticsController {
  private final BuyerAnalyticsApplicationService buyerAnalyticsApplicationService;

  public BuyerAnalyticsController(
      BuyerAnalyticsApplicationService buyerAnalyticsApplicationService) {
    this.buyerAnalyticsApplicationService = buyerAnalyticsApplicationService;
  }

  @GetMapping("/procurement")
  public ApiResponse<ProcurementAnalyticsResponse> procurement(
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
      @RequestParam(required = false) String supplierId,
      @RequestParam(required = false) String status) {
    return ApiResponse.ok(buyerAnalyticsApplicationService.procurementAnalytics(fromDate, toDate, supplierId, status));
  }
}
