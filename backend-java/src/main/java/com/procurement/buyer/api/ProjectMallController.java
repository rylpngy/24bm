package com.procurement.buyer.api;

import com.procurement.buyer.api.ProjectMallContracts.*;
import com.procurement.buyer.application.ProjectMallService;
import com.procurement.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/projects/{project}/packages/{id}")
public record ProjectMallController(ProjectMallService service) {
  @GetMapping("/mall-selection")
  @Operation(operationId = "procurementProjectMallSelection")
  public ApiResponse<Selection> selection(@PathVariable String project, @PathVariable String id) {
    return ApiResponse.ok(service.selection(project, id));
  }

  @PostMapping("/mall-checkout")
  @Operation(operationId = "procurementProjectMallCheckout")
  public ApiResponse<Selection> checkout(
      @PathVariable String project, @PathVariable String id, @Valid @RequestBody Checkout request) {
    return ApiResponse.ok(service.checkout(project, id, request));
  }
}
