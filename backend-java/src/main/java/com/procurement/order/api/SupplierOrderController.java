package com.procurement.order.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.order.application.PurchaseOrderApplicationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/orders")
public class SupplierOrderController {
  private final PurchaseOrderApplicationService purchaseOrderApplicationService;

  public SupplierOrderController(PurchaseOrderApplicationService purchaseOrderApplicationService) {
    this.purchaseOrderApplicationService = purchaseOrderApplicationService;
  }

  @GetMapping
  public ApiResponse<List<PurchaseOrderResponse>> list() {
    return ApiResponse.ok(purchaseOrderApplicationService.listCurrentSupplierOrders());
  }

  @PostMapping("/{orderId}/confirm")
  public ApiResponse<PurchaseOrderResponse> confirm(@PathVariable String orderId) {
    return ApiResponse.ok(purchaseOrderApplicationService.confirmCurrentSupplierOrder(orderId));
  }
}
