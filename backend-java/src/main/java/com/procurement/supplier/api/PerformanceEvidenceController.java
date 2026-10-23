package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.PerformanceEvidenceService;
import java.nio.charset.StandardCharsets;
import java.net.URLEncoder;
import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class PerformanceEvidenceController {
  private final PerformanceEvidenceService service;
  public PerformanceEvidenceController(PerformanceEvidenceService service) { this.service = service; }

  @GetMapping("/api/v1/supplier/performance-tasks/{taskId}/evidence")
  public ApiResponse<List<PerformanceEvidenceResponse>> supplierList(@PathVariable String taskId) {
    return ApiResponse.ok(service.listSupplier(taskId));
  }
  @PostMapping(value = "/api/v1/supplier/performance-tasks/{taskId}/evidence", consumes = "application/octet-stream")
  @io.swagger.v3.oas.annotations.Operation(requestBody = @io.swagger.v3.oas.annotations.parameters.RequestBody(required = true,
      content = @io.swagger.v3.oas.annotations.media.Content(mediaType = "application/octet-stream",
          schema = @io.swagger.v3.oas.annotations.media.Schema(type = "string", format = "binary"))))
  public ApiResponse<PerformanceEvidenceResponse> upload(@PathVariable String taskId,
      @RequestParam long expectedVersion, @RequestParam String fileName, java.io.InputStream body) throws java.io.IOException {
    byte[] data = body.readNBytes(10 * 1024 * 1024 + 1);
    if (data.length > 10 * 1024 * 1024) throw new IllegalArgumentException("文件不能超过10MB");
    return ApiResponse.ok(service.upload(taskId, expectedVersion, fileName, data));
  }
  @GetMapping("/api/v1/buyer/suppliers/{relationId}/performance-tasks/{taskId}/evidence")
  public ApiResponse<List<PerformanceEvidenceResponse>> buyerList(@PathVariable String relationId, @PathVariable String taskId) {
    return ApiResponse.ok(service.listBuyer(relationId, taskId));
  }
  @GetMapping("/api/v1/supplier/performance-tasks/{taskId}/evidence/{id}/download")
  public ResponseEntity<byte[]> supplierDownload(@PathVariable String taskId, @PathVariable String id) {
    return response(service.downloadSupplier(taskId, id));
  }
  @GetMapping("/api/v1/buyer/suppliers/{relationId}/performance-tasks/{taskId}/evidence/{id}/download")
  public ResponseEntity<byte[]> buyerDownload(@PathVariable String relationId, @PathVariable String taskId, @PathVariable String id) {
    return response(service.downloadBuyer(relationId, taskId, id));
  }
  private ResponseEntity<byte[]> response(PerformanceEvidenceService.Download file) {
    return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM)
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + URLEncoder.encode(file.fileName(), StandardCharsets.UTF_8).replace("+", "%20"))
        .header(HttpHeaders.CACHE_CONTROL, "no-store").header("X-Content-Type-Options", "nosniff").body(file.data());
  }
}
