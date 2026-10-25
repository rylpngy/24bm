package com.procurement.buyer.api;

import com.procurement.buyer.api.ProjectLifecycleContracts.*;
import com.procurement.buyer.api.ProjectLifecycleContracts.Record;
import com.procurement.buyer.application.ProjectLifecycleService;
import com.procurement.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/projects/{project}/lifecycle")
public record ProjectLifecycleController(ProjectLifecycleService service) {
  @Operation(operationId = "projectLifecyclePreview")
  @GetMapping("/preview")
  public ApiResponse<Preview> preview(@PathVariable String project) {
    return ApiResponse.ok(service.preview(project));
  }

  @Operation(operationId = "projectLifecycleHistory")
  @GetMapping
  public ApiResponse<Page> history(
      @PathVariable String project,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int pageSize) {
    return ApiResponse.ok(service.history(project, page, pageSize));
  }

  @Operation(operationId = "projectLifecycleSubmit")
  @PostMapping
  public ApiResponse<Record> submit(
      @PathVariable String project, @Valid @RequestBody Request request) {
    return ApiResponse.ok(service.submit(project, request));
  }

  @Operation(operationId = "projectLifecycleWithdraw")
  @PostMapping("/{id}/withdraw")
  public ApiResponse<Record> withdraw(
      @PathVariable String project,
      @PathVariable String id,
      @Valid @RequestBody ProjectContracts.Action request) {
    return ApiResponse.ok(service.withdraw(project, id, request.revision(), request.reason()));
  }
}
