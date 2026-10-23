package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.PerformanceTaskApplicationService;
import com.procurement.supplier.api.PerformanceTaskRequests.*;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/suppliers/{relationId}")
public class BuyerPerformanceTaskController {
  private final PerformanceTaskApplicationService service;
  public BuyerPerformanceTaskController(PerformanceTaskApplicationService service) { this.service = service; }

  @GetMapping("/performance-tasks")
  public ApiResponse<List<PerformanceTaskResponse>> list(@PathVariable String relationId) {
    return ApiResponse.ok(service.listBuyer(relationId));
  }
  @GetMapping("/performance-assignees")
  public ApiResponse<List<PerformanceTaskResponse.Assignee>> assignees(@PathVariable String relationId) {
    return ApiResponse.ok(service.assignees(relationId));
  }
  @PostMapping("/performance-tasks")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<PerformanceTaskResponse> create(@PathVariable String relationId, @Valid @RequestBody Create request) {
    return ApiResponse.ok(service.create(relationId, request));
  }
  @PostMapping("/performance-tasks/{taskId}/evaluate")
  public ApiResponse<PerformanceTaskResponse> evaluate(@PathVariable String relationId, @PathVariable String taskId,
      @Valid @RequestBody Evaluate request) {
    return ApiResponse.ok(service.evaluate(relationId, taskId, request));
  }
  @PostMapping("/performance-tasks/{taskId}/request-remediation")
  public ApiResponse<PerformanceTaskResponse> remediation(@PathVariable String relationId, @PathVariable String taskId,
      @Valid @RequestBody Remediation request) {
    return ApiResponse.ok(service.requestRemediation(relationId, taskId, request));
  }
  @PostMapping("/performance-tasks/{taskId}/review")
  public ApiResponse<PerformanceTaskResponse> review(@PathVariable String relationId, @PathVariable String taskId,
      @Valid @RequestBody Review request) {
    return ApiResponse.ok(service.review(relationId, taskId, request));
  }
}
