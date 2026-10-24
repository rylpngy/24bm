package com.procurement.mall.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.mall.application.MallServiceApplicationService;
import com.procurement.mall.domain.MallAfterSalesEvent;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/mall/after-sales")
public class BuyerMallAfterSalesController {
  private final MallServiceApplicationService service;

  public BuyerMallAfterSalesController(MallServiceApplicationService service) {
    this.service = service;
  }

  @PostMapping("/{id}/confirm")
  public ApiResponse<List<MallAfterSalesResponse>> confirm(
      @PathVariable String id, @Valid @RequestBody BuyerAfterSalesActionRequest request) {
    return ApiResponse.ok(service.buyerAction(id, "confirm", request.note()).stream()
        .map(MallAfterSalesResponse::from).toList());
  }

  @PostMapping("/{id}/withdraw")
  public ApiResponse<List<MallAfterSalesResponse>> withdraw(
      @PathVariable String id, @Valid @RequestBody BuyerAfterSalesActionRequest request) {
    return ApiResponse.ok(service.buyerAction(id, "withdraw", request.note()).stream()
        .map(MallAfterSalesResponse::from).toList());
  }

  @GetMapping("/{id}/history")
  public ApiResponse<List<MallAfterSalesEvent>> history(@PathVariable String id) {
    return ApiResponse.ok(service.buyerHistory(id));
  }
}
