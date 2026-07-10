package com.procurement.mall.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.mall.api.CreateMallCartRequest;
import com.procurement.mall.application.MallApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/mall")
public class BuyerMallController {
  private final MallApplicationService mallApplicationService;

  public BuyerMallController(MallApplicationService mallApplicationService) {
    this.mallApplicationService = mallApplicationService;
  }

  @GetMapping("/listings")
  public ApiResponse<List<MallListingResponse>> listings(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(mallApplicationService.listCurrentTenantListings(status, keyword));
  }

  @PostMapping("/listings")
  public ApiResponse<MallListingResponse> publish(@Valid @RequestBody CreateMallListingRequest request) {
    return ApiResponse.ok(mallApplicationService.publishListing(request));
  }

  @PutMapping("/listings/{listingId}/status")
  public ApiResponse<MallListingResponse> updateStatus(
      @PathVariable String listingId,
      @Valid @RequestBody UpdateMallListingStatusRequest request) {
    return ApiResponse.ok(mallApplicationService.updateListingStatus(listingId, request));
  }

  @PostMapping("/orders")
  public ApiResponse<MallOrderResponse> createOrder(@Valid @RequestBody CreateMallOrderRequest request) {
    return ApiResponse.ok(mallApplicationService.createDirectOrder(request));
  }

  // 购物车结算:多商品一次下单,按供应商合并成单。
  @PostMapping("/orders/batch")
  public ApiResponse<List<MallOrderResponse>> checkoutCart(@Valid @RequestBody CreateMallCartRequest request) {
    return ApiResponse.ok(mallApplicationService.checkoutCart(request));
  }
}
