package com.procurement.sourcing.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.sourcing.application.ProcurementExecutionApplicationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotBlank;
import java.nio.charset.StandardCharsets;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/rfqs/{rfqId}/execution")
public class ProcurementExecutionController {
  private final ProcurementExecutionApplicationService service;
  public ProcurementExecutionController(ProcurementExecutionApplicationService service) { this.service = service; }

  @GetMapping
  public ApiResponse<ProcurementExecutionResponse> get(@PathVariable String rfqId) {
    return ApiResponse.ok(service.get(rfqId));
  }

  public record ArchiveRequest(@NotBlank @Size(min = 1, max = 1000) String remark) {}

  @PostMapping("/archives")
  public ApiResponse<ProcurementExecutionResponse.ArchiveSummary> archive(
      @PathVariable String rfqId, @Valid @RequestBody ArchiveRequest request) {
    return ApiResponse.ok(service.archive(rfqId, request.remark()));
  }

  @GetMapping("/archives/{id}/download")
  public ResponseEntity<byte[]> download(@PathVariable String rfqId, @PathVariable String id) {
    byte[] bytes = service.download(rfqId, id);
    return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/zip"))
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
            .filename("采购档案-" + id.replaceAll("[^a-zA-Z0-9-]", "_") + ".zip", StandardCharsets.UTF_8).build().toString())
        .contentLength(bytes.length).body(bytes);
  }
}
