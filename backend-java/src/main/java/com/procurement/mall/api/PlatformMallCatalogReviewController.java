package com.procurement.mall.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.mall.application.MallPublicCatalogReviewApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/platform/mall/products")
public class PlatformMallCatalogReviewController {
  private final MallPublicCatalogReviewApplicationService reviews;

  public PlatformMallCatalogReviewController(MallPublicCatalogReviewApplicationService reviews) {
    this.reviews = reviews;
  }

  @GetMapping("/pending-review")
  public ApiResponse<List<MallProductResponse>> pendingReview() {
    return ApiResponse.ok(reviews.listPendingReview());
  }

  @PostMapping("/{productId}/review")
  public ApiResponse<MallProductResponse> review(@PathVariable String productId,
      @Valid @RequestBody ReviewMallProductRequest request) {
    return ApiResponse.ok(reviews.review(productId, request));
  }
}
