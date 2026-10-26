package com.procurement.order.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.order.application.PurchaseOrderApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/orders")
public class PurchaseOrderController {
  @org.springframework.beans.factory.annotation.Autowired private com.procurement.order.application.OrderCancellationService cancellation;
  @GetMapping("/{orderId}/cancellations")
  public ApiResponse<OrderCancellationContracts.View> cancellations(@PathVariable String orderId,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="10") int size){return ApiResponse.ok(cancellation.view(orderId,false,page,size));}
  @PostMapping("/{orderId}/cancellations")
  public ApiResponse<OrderCancellationContracts.Entry> cancel(@PathVariable String orderId,@Valid @RequestBody OrderCancellationContracts.Request request){return ApiResponse.ok(cancellation.request(orderId,request));}
  @PostMapping("/{orderId}/cancellations/{requestId}")
  public ApiResponse<OrderCancellationContracts.Entry> cancellationDecision(@PathVariable String orderId,@PathVariable String requestId,@Valid @RequestBody OrderCancellationContracts.Decision request){return ApiResponse.ok(cancellation.decide(orderId,requestId,request,false));}
  private final PurchaseOrderApplicationService purchaseOrderApplicationService;

  public PurchaseOrderController(PurchaseOrderApplicationService purchaseOrderApplicationService) {
    this.purchaseOrderApplicationService = purchaseOrderApplicationService;
  }

  @GetMapping
  public ApiResponse<List<PurchaseOrderResponse>> list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String supplierId,
      @RequestParam(required = false) String rfqId) {
    return ApiResponse.ok(purchaseOrderApplicationService.listCurrentTenantOrders(status, supplierId, rfqId));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<PurchaseOrderResponse> create(@Valid @RequestBody CreatePurchaseOrderRequest request) {
    return ApiResponse.ok(purchaseOrderApplicationService.createFromAward(request));
  }

  @PutMapping("/{orderId}")
  public ApiResponse<PurchaseOrderResponse> update(
      @PathVariable String orderId,
      @Valid @RequestBody UpdatePurchaseOrderRequest request) {
    return ApiResponse.ok(purchaseOrderApplicationService.update(orderId, request));
  }
}
