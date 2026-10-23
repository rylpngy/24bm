package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.PerformanceTaskApplicationService;
import com.procurement.supplier.api.PerformanceTaskRequests.Response;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/supplier/performance-tasks")
public class SupplierPerformanceTaskController {
  private final PerformanceTaskApplicationService service;
  public SupplierPerformanceTaskController(PerformanceTaskApplicationService service) { this.service = service; }
  @GetMapping
  public ApiResponse<List<PerformanceTaskResponse>> list() { return ApiResponse.ok(service.listSupplier()); }
  @PostMapping("/{taskId}/response")
  public ApiResponse<PerformanceTaskResponse> respond(@PathVariable String taskId, @Valid @RequestBody Response request) {
    return ApiResponse.ok(service.respond(taskId, request));
  }
}
