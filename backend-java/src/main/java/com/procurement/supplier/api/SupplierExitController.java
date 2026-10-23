package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.SupplierExitApplicationService;
import com.procurement.workflow.application.WorkflowStartResult;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/suppliers")
public class SupplierExitController {
  private final SupplierExitApplicationService service;
  public SupplierExitController(SupplierExitApplicationService service) { this.service = service; }

  @PostMapping("/{relationId}/exit")
  public ApiResponse<WorkflowStartResult> submitExit(@PathVariable String relationId,
      @Valid @RequestBody SubmitSupplierExitRequest request) {
    return ApiResponse.ok(service.submit(relationId, request));
  }
}
