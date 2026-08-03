package com.procurement.mall.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.mall.application.MallApplicationService;
import com.procurement.mall.application.MallCatalogApplicationService;
import com.procurement.mall.application.MallServiceApplicationService;
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

  private final MallCatalogApplicationService mallCatalogApplicationService;
  private final MallServiceApplicationService mallServiceApplicationService;

  public SupplierMallController(MallApplicationService mallApplicationService,
      MallCatalogApplicationService mallCatalogApplicationService,
      MallServiceApplicationService mallServiceApplicationService) {
    this.mallCatalogApplicationService = mallCatalogApplicationService;
    this.mallServiceApplicationService = mallServiceApplicationService;
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

  // ── M-1 商品与规格维护 ───────────────────────────────────
  @GetMapping("/products")
  public ApiResponse<List<MallProductResponse>> products() {
    return ApiResponse.ok(mallCatalogApplicationService.listForSupplier());
  }

  @PostMapping("/products")
  public ApiResponse<MallProductResponse> createProduct(
      @Valid @RequestBody SaveMallProductRequest request) {
    return ApiResponse.ok(mallCatalogApplicationService.createProduct(request));
  }

  @PutMapping("/products/{productId}")
  public ApiResponse<MallProductResponse> updateProduct(
      @PathVariable String productId, @Valid @RequestBody SaveMallProductRequest request) {
    return ApiResponse.ok(mallCatalogApplicationService.updateProduct(productId, request));
  }

  @PutMapping("/products/{productId}/status")
  public ApiResponse<MallProductResponse> updateProductStatus(
      @PathVariable String productId, @Valid @RequestBody UpdateMallProductStatusRequest request) {
    return ApiResponse.ok(mallCatalogApplicationService.updateProductStatus(productId, request));
  }

  @PostMapping("/products/{productId}/skus")
  public ApiResponse<MallProductResponse> addSku(
      @PathVariable String productId, @Valid @RequestBody SaveMallSkuRequest request) {
    return ApiResponse.ok(mallCatalogApplicationService.addSku(productId, request));
  }

  @PutMapping("/products/{productId}/skus/{skuId}")
  public ApiResponse<MallProductResponse> updateSku(
      @PathVariable String productId,
      @PathVariable String skuId,
      @Valid @RequestBody SaveMallSkuRequest request) {
    return ApiResponse.ok(mallCatalogApplicationService.updateSku(productId, skuId, request));
  }

  @PutMapping("/products/{productId}/skus/{skuId}/status")
  public ApiResponse<MallProductResponse> updateSkuStatus(
      @PathVariable String productId,
      @PathVariable String skuId,
      @Valid @RequestBody UpdateMallProductStatusRequest request) {
    return ApiResponse.ok(
        mallCatalogApplicationService.updateSkuStatus(productId, skuId, request.status()));
  }

  // ── M-4 售后处理 ────────────────────────────────────────
  @GetMapping("/after-sales")
  public ApiResponse<List<MallAfterSalesResponse>> afterSales() {
    return ApiResponse.ok(toAfterSales(mallServiceApplicationService.listAfterSalesForSupplier()));
  }

  @PutMapping("/after-sales/{afterSalesId}")
  public ApiResponse<List<MallAfterSalesResponse>> handleAfterSales(
      @PathVariable String afterSalesId, @Valid @RequestBody HandleAfterSalesRequest request) {
    return ApiResponse.ok(
        toAfterSales(mallServiceApplicationService.handleAfterSales(afterSalesId, request)));
  }

  private static List<MallAfterSalesResponse> toAfterSales(
      List<com.procurement.mall.domain.MallAfterSales> rows) {
    return rows.stream()
        .map(a -> new MallAfterSalesResponse(
            a.id(), a.orderId(), a.orderLineId(), a.supplierId(), a.supplierName(), a.type(),
            a.quantity(), a.reason(), a.status(), a.supplierReply(), a.createdAt(), a.updatedAt()))
        .toList();
  }
}
