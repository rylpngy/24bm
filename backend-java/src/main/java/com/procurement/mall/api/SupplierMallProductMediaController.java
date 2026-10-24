package com.procurement.mall.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.mall.application.MallProductMediaApplicationService;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/supplier/mall/products/{productId}/media")
public class SupplierMallProductMediaController {
  public record FileRequest(@NotBlank String fileName) {}
  public record RegisterRequest(@NotBlank String storageKey) {}
  private final MallProductMediaApplicationService service;
  public SupplierMallProductMediaController(MallProductMediaApplicationService service) { this.service=service; }

  @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
  public ResponseEntity<ApiResponse<Void>> uploadFailure(org.springframework.web.server.ResponseStatusException error) {
    return ResponseEntity.status(error.getStatusCode()).body(ApiResponse.fail(error.getReason()));
  }

  @GetMapping public ApiResponse<List<MallProductMediaResponse>> list(@PathVariable String productId) {
    return ApiResponse.ok(service.listSupplier(productId));
  }
  @PostMapping("/upload-ticket") public ApiResponse<MallProductMediaApplicationService.Ticket> ticket(
      @PathVariable String productId,@Valid @RequestBody FileRequest request) {
    return ApiResponse.ok(service.ticket(productId,request.fileName()));
  }
  @io.swagger.v3.oas.annotations.Operation(requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(
      required = true, content = @io.swagger.v3.oas.annotations.media.Content(mediaType = "application/octet-stream",
          schema = @io.swagger.v3.oas.annotations.media.Schema(type = "string", format = "binary"))))
  @PostMapping(value="/upload-sink",consumes="application/octet-stream") public ApiResponse<Void> upload(@PathVariable String productId,
      @RequestParam String storageKey,@RequestParam String token,HttpServletRequest request) throws java.io.IOException {
    service.upload(productId,storageKey,token,request.getInputStream(),request.getContentLengthLong());
    return ApiResponse.ok(null);
  }
  @PostMapping public ApiResponse<List<MallProductMediaResponse>> register(@PathVariable String productId,
      @Valid @RequestBody RegisterRequest request) {
    return ApiResponse.ok(service.register(productId,request.storageKey()));
  }
  @PutMapping("/{mediaId}/main") public ApiResponse<List<MallProductMediaResponse>> main(
      @PathVariable String productId,@PathVariable String mediaId) {
    return ApiResponse.ok(service.setMain(productId,mediaId));
  }
  @DeleteMapping("/{mediaId}") public ApiResponse<List<MallProductMediaResponse>> delete(
      @PathVariable String productId,@PathVariable String mediaId) {
    return ApiResponse.ok(service.delete(productId,mediaId));
  }
  @GetMapping("/{mediaId}/content") public ResponseEntity<byte[]> content(@PathVariable String productId,@PathVariable String mediaId) {
    return BuyerMallProductMediaController.response(service.image(productId,mediaId,false));
  }
}
