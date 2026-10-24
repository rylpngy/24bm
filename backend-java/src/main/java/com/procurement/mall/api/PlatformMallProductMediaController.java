package com.procurement.mall.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.mall.application.MallProductMediaApplicationService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/platform/mall/products/{productId}/media")
public class PlatformMallProductMediaController {
  private final MallProductMediaApplicationService service;
  public PlatformMallProductMediaController(MallProductMediaApplicationService service) { this.service=service; }
  @GetMapping public ApiResponse<List<MallProductMediaResponse>> list(@PathVariable String productId) {
    return ApiResponse.ok(service.listPublicReview(productId));
  }
  @GetMapping("/{mediaId}/content") public ResponseEntity<byte[]> content(@PathVariable String productId,@PathVariable String mediaId) {
    return BuyerMallProductMediaController.response(service.publicReviewImage(productId,mediaId));
  }
}
