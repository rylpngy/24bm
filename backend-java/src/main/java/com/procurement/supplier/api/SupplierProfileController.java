package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.SupplierProfileApplicationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/profile")
public class SupplierProfileController {
  private final SupplierProfileApplicationService supplierProfileApplicationService;

  public SupplierProfileController(SupplierProfileApplicationService supplierProfileApplicationService) {
    this.supplierProfileApplicationService = supplierProfileApplicationService;
  }

  @GetMapping
  public ApiResponse<SupplierProfileResponse> get() {
    return ApiResponse.ok(supplierProfileApplicationService.getCurrentSupplierProfile());
  }

  @PostMapping
  public ApiResponse<SupplierProfileResponse> update(@Valid @RequestBody UpdateSupplierProfileRequest request) {
    return ApiResponse.ok(supplierProfileApplicationService.updateCurrentSupplierProfile(request));
  }
}
