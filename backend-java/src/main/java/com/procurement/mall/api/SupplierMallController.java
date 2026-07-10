package com.procurement.mall.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.mall.application.MallApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// 供应商自助货架:查看/发布自己的协议价商品,自主调价与上下架。
@RestController
@RequestMapping("/api/v1/supplier/mall")
public class SupplierMallController {
  private final MallApplicationService mallApplicationService;

  public SupplierMallController(MallApplicationService mallApplicationService) {
    this.mallApplicationService = mallApplicationService;
  }

  @GetMapping("/listings")
  public ApiResponse<List<MallListingResponse>> listings() {
    return ApiResponse.ok(mallApplicationService.listSupplierListings());
  }

  @GetMapping("/materials")
  public ApiResponse<List<SupplierMallMaterialResponse>> materials() {
    return ApiResponse.ok(mallApplicationService.listSupplierMaterials());
  }

  @PostMapping("/listings")
  public ApiResponse<MallListingResponse> publish(
      @Valid @RequestBody SupplierPublishMallListingRequest request) {
    return ApiResponse.ok(mallApplicationService.supplierPublishListing(request));
  }

  @PutMapping("/listings/{listingId}/price")
  public ApiResponse<MallListingResponse> updatePrice(
      @PathVariable String listingId,
      @Valid @RequestBody UpdateMallListingPriceRequest request) {
    return ApiResponse.ok(mallApplicationService.supplierUpdatePrice(listingId, request));
  }

  @PutMapping("/listings/{listingId}/status")
  public ApiResponse<MallListingResponse> updateStatus(
      @PathVariable String listingId,
      @Valid @RequestBody UpdateMallListingStatusRequest request) {
    return ApiResponse.ok(mallApplicationService.supplierUpdateStatus(listingId, request));
  }
}
