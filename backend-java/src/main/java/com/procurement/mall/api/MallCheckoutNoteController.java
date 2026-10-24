package com.procurement.mall.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.mall.application.MallPurchaseControlApplicationService;
import org.springframework.web.bind.annotation.*;

@RestController
public class MallCheckoutNoteController {
  private final MallPurchaseControlApplicationService service;
  public MallCheckoutNoteController(MallPurchaseControlApplicationService service){this.service=service;}
  @GetMapping("/api/v1/buyer/mall/orders/{orderId}/checkout-note")
  public ApiResponse<String> buyer(@PathVariable String orderId){return ApiResponse.ok(service.buyerCheckoutNote(orderId));}
  @GetMapping("/api/v1/supplier/mall/orders/{orderId}/checkout-note")
  public ApiResponse<String> supplier(@PathVariable String orderId){return ApiResponse.ok(service.supplierCheckoutNote(orderId));}
}
