package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.SupplierWorkspaceApplicationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/workspace")
public class SupplierWorkspaceController {
  private final SupplierWorkspaceApplicationService supplierWorkspaceApplicationService;

  public SupplierWorkspaceController(SupplierWorkspaceApplicationService supplierWorkspaceApplicationService) {
    this.supplierWorkspaceApplicationService = supplierWorkspaceApplicationService;
  }

  @GetMapping
  public ApiResponse<SupplierWorkspaceResponse> load() {
    return ApiResponse.ok(supplierWorkspaceApplicationService.load());
  }
}
