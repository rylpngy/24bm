package com.procurement.mall.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.common.storage.ObjectStorageService;
import com.procurement.mall.application.MallProductMediaApplicationService;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/mall/products/{productId}")
public class BuyerMallProductMediaController {
  private final MallProductMediaApplicationService service;
  public BuyerMallProductMediaController(MallProductMediaApplicationService service) { this.service=service; }
  @GetMapping("/media") public ApiResponse<List<MallProductMediaResponse>> list(@PathVariable String productId) {
    return ApiResponse.ok(service.listBuyer(productId));
  }
  @GetMapping("/media/{mediaId}/content") public ResponseEntity<byte[]> content(@PathVariable String productId,@PathVariable String mediaId) {
    return response(service.image(productId,mediaId,true));
  }
  @GetMapping("/review-media") public ApiResponse<List<MallProductMediaResponse>> reviewList(@PathVariable String productId) {
    return ApiResponse.ok(service.listBuyerReview(productId));
  }
  @GetMapping("/review-media/{mediaId}/content") public ResponseEntity<byte[]> reviewContent(@PathVariable String productId,@PathVariable String mediaId) {
    return response(service.buyerReviewImage(productId,mediaId));
  }
  static ResponseEntity<byte[]> response(ObjectStorageService.StoredObject object) {
    return ResponseEntity.ok().header("Cache-Control","no-store, private")
        .header("X-Content-Type-Options","nosniff").contentType(MediaType.parseMediaType(object.contentType())).body(object.data());
  }
}
