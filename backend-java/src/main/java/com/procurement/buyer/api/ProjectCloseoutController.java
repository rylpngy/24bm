package com.procurement.buyer.api;

import com.procurement.buyer.application.ProjectCloseoutService;
import com.procurement.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/projects/{project}")
public record ProjectCloseoutController(ProjectCloseoutService service) {
  @Operation(operationId = "procurementProjectAdjustments")
  @GetMapping("/adjustments")
  public ApiResponse<ProjectCloseoutContracts.AdjustmentPage> history(
      @PathVariable String project,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int pageSize) {
    return ApiResponse.ok(service.history(project, page, pageSize));
  }

  @Operation(operationId = "procurementProjectMonitor")
  @GetMapping("/monitor")
  public ApiResponse<ProjectCloseoutContracts.Monitor> monitor(@PathVariable String project) {
    return ApiResponse.ok(service.monitor(project));
  }

  @Operation(operationId = "procurementProjectPackageRework")
  @PostMapping("/packages/{id}/rework")
  public ApiResponse<Void> rework(
      @PathVariable String project,
      @PathVariable String id,
      @RequestBody @Valid ProjectExpansionContracts.PackageAction a) {
    service.adjust(project, id, a, true);
    return ApiResponse.ok(null);
  }

  @Operation(operationId = "procurementProjectPackageStop")
  @PostMapping("/packages/{id}/stop")
  public ApiResponse<Void> stop(
      @PathVariable String project,
      @PathVariable String id,
      @RequestBody @Valid ProjectExpansionContracts.PackageAction a) {
    service.adjust(project, id, a, false);
    return ApiResponse.ok(null);
  }

  @Operation(operationId = "procurementProjectMilestoneSave")
  @PostMapping("/packages/{id}/milestones")
  public ApiResponse<Void> plan(
      @PathVariable String project,
      @PathVariable String id,
      @RequestBody @Valid ProjectCloseoutContracts.Plan a) {
    service.plan(project, id, a);
    return ApiResponse.ok(null);
  }

  @Operation(operationId = "procurementProjectArchiveDownload")
  @GetMapping("/archive/download")
  public ResponseEntity<byte[]> download(@PathVariable String project) {
    byte[] bytes = service.download(project);
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType("application/zip"))
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            "attachment; filename=\"project-" + project.replaceAll("[^a-zA-Z0-9-]", "_") + ".zip\"")
        .contentLength(bytes.length)
        .body(bytes);
  }
}
