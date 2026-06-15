package com.procurement.order.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.order.application.DeliveryApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier")
public class SupplierDeliveryController {
  private final DeliveryApplicationService deliveryApplicationService;

  public SupplierDeliveryController(DeliveryApplicationService deliveryApplicationService) {
    this.deliveryApplicationService = deliveryApplicationService;
  }

  @GetMapping("/deliveries")
  public ApiResponse<List<DeliveryResponse>> list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String orderId) {
    return ApiResponse.ok(deliveryApplicationService.listCurrentSupplierDeliveries(status, orderId));
  }

  @PostMapping("/orders/{orderId}/deliveries")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<DeliveryResponse> create(@PathVariable String orderId, @Valid @RequestBody CreateDeliveryRequest request) {
    return ApiResponse.ok(deliveryApplicationService.create(orderId, request));
  }
}
