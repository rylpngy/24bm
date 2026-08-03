package com.procurement.mall.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.mall.api.CreateMallCartRequest;
import com.procurement.mall.application.MallApplicationService;
import com.procurement.mall.application.MallCartApplicationService;
import com.procurement.mall.application.MallCatalogApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
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

  private final MallCatalogApplicationService mallCatalogApplicationService;
  private final MallCartApplicationService mallCartApplicationService;

  public BuyerMallController(
      MallApplicationService mallApplicationService,
      MallCatalogApplicationService mallCatalogApplicationService,
      MallCartApplicationService mallCartApplicationService) {
    this.mallCatalogApplicationService = mallCatalogApplicationService;
    this.mallCartApplicationService = mallCartApplicationService;
    this.mallApplicationService = mallApplicationService;
  }

  // ── M-1 商品目录 ─────────────────────────────────────────
  @GetMapping("/products")
  public ApiResponse<List<MallProductResponse>> products(
      @RequestParam(required = false) String categoryId,
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(mallCatalogApplicationService.listForBuyer(categoryId, keyword));
  }

  @GetMapping("/products/{productId}")
  public ApiResponse<MallProductResponse> product(@PathVariable String productId) {
    return ApiResponse.ok(mallCatalogApplicationService.findForBuyer(productId));
  }

  @GetMapping("/categories")
  public ApiResponse<List<MallCategoryResponse>> categories() {
    return ApiResponse.ok(mallCatalogApplicationService.listCategories().stream()
        .map(c -> new MallCategoryResponse(c.id(), c.parentId(), c.name(), c.tenantId() == null))
        .toList());
  }

  @GetMapping("/analytics")
  public ApiResponse<MallAnalyticsResponse> analytics() {
    return ApiResponse.ok(mallApplicationService.mallAnalytics());
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

  // ── M-2 服务端购物车 ─────────────────────────────────────
  @GetMapping("/cart")
  public ApiResponse<MallCartResponse> cart() {
    return ApiResponse.ok(mallCartApplicationService.view());
  }

  @PostMapping("/cart/items")
  public ApiResponse<MallCartResponse> addToCart(
      @Valid @RequestBody SaveMallCartItemRequest request) {
    return ApiResponse.ok(mallCartApplicationService.addItem(request.skuId(), request.quantity()));
  }

  @PutMapping("/cart/items")
  public ApiResponse<MallCartResponse> updateCartItem(
      @Valid @RequestBody SaveMallCartItemRequest request) {
    return ApiResponse.ok(
        mallCartApplicationService.updateQuantity(request.skuId(), request.quantity()));
  }

  /** 以服务端购物车为准结算:清单不由前端提交,成功后清空购物车。 */
  @PostMapping("/cart/checkout")
  public ApiResponse<List<MallOrderResponse>> checkoutServerCart(
      @Valid @RequestBody CheckoutCartRequest request) {
    return ApiResponse.ok(mallApplicationService.checkoutServerCart(request));
  }

  @DeleteMapping("/cart/items/{skuId}")
  public ApiResponse<MallCartResponse> removeCartItem(@PathVariable String skuId) {
    return ApiResponse.ok(mallCartApplicationService.removeItem(skuId));
  }

  // ── M-2 收货地址簿 ───────────────────────────────────────
  @GetMapping("/addresses")
  public ApiResponse<List<MallAddressResponse>> addresses() {
    return ApiResponse.ok(toAddressResponses(mallCartApplicationService.listAddresses()));
  }

  @PostMapping("/addresses")
  public ApiResponse<List<MallAddressResponse>> addAddress(
      @Valid @RequestBody SaveMallAddressRequest request) {
    return ApiResponse.ok(toAddressResponses(mallCartApplicationService.saveAddress(request)));
  }

  @PutMapping("/addresses/{addressId}/default")
  public ApiResponse<List<MallAddressResponse>> markDefaultAddress(@PathVariable String addressId) {
    return ApiResponse.ok(
        toAddressResponses(mallCartApplicationService.markDefaultAddress(addressId)));
  }

  @DeleteMapping("/addresses/{addressId}")
  public ApiResponse<List<MallAddressResponse>> deleteAddress(@PathVariable String addressId) {
    return ApiResponse.ok(toAddressResponses(mallCartApplicationService.deleteAddress(addressId)));
  }

  private static List<MallAddressResponse> toAddressResponses(
      List<com.procurement.mall.domain.MallAddress> addresses) {
    return addresses.stream()
        .map(a -> new MallAddressResponse(
            a.id(), a.receiver(), a.phone(), a.province(), a.city(), a.district(),
            a.detail(), a.isDefault()))
        .toList();
  }
}
