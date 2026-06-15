package com.procurement.order.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.order.application.PurchaseOrderApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/orders")
public class PurchaseOrderController {
  private final PurchaseOrderApplicationService purchaseOrderApplicationService;

  public PurchaseOrderController(PurchaseOrderApplicationService purchaseOrderApplicationService) {
    this.purchaseOrderApplicationService = purchaseOrderApplicationService;
  }

  @GetMapping
  public ApiResponse<List<PurchaseOrderResponse>> list() {
    return ApiResponse.ok(purchaseOrderApplicationService.listCurrentTenantOrders());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<PurchaseOrderResponse> create(@Valid @RequestBody CreatePurchaseOrderRequest request) {
    return ApiResponse.ok(purchaseOrderApplicationService.createFromAward(request));
  }
}
