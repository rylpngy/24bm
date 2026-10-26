package com.procurement.order.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.order.application.PurchaseOrderApplicationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/orders")
public class SupplierOrderController {
  @org.springframework.beans.factory.annotation.Autowired private com.procurement.order.application.OrderCancellationService cancellation;
  @GetMapping("/{orderId}/cancellations")
  public ApiResponse<OrderCancellationContracts.View> cancellations(@PathVariable String orderId,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="10") int size){return ApiResponse.ok(cancellation.view(orderId,true,page,size));}
  @PostMapping("/{orderId}/cancellations/{requestId}")
  public ApiResponse<OrderCancellationContracts.Entry> cancellationDecision(@PathVariable String orderId,@PathVariable String requestId,@jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody OrderCancellationContracts.Decision request){return ApiResponse.ok(cancellation.decide(orderId,requestId,request,true));}
  private final PurchaseOrderApplicationService purchaseOrderApplicationService;

  public SupplierOrderController(PurchaseOrderApplicationService purchaseOrderApplicationService) {
    this.purchaseOrderApplicationService = purchaseOrderApplicationService;
  }

  @GetMapping
  public ApiResponse<List<PurchaseOrderResponse>> list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String rfqId) {
    return ApiResponse.ok(purchaseOrderApplicationService.listCurrentSupplierOrders(status, rfqId));
  }

  @PostMapping("/{orderId}/confirm")
  public ApiResponse<PurchaseOrderResponse> confirm(@PathVariable String orderId) {
    return ApiResponse.ok(purchaseOrderApplicationService.confirmCurrentSupplierOrder(orderId));
  }
}
