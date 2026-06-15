package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.SupplierQualificationApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/qualifications")
public class SupplierQualificationController {
  private final SupplierQualificationApplicationService supplierQualificationApplicationService;

  public SupplierQualificationController(SupplierQualificationApplicationService supplierQualificationApplicationService) {
    this.supplierQualificationApplicationService = supplierQualificationApplicationService;
  }

  @GetMapping
  public ApiResponse<List<SupplierQualificationResponse>> list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(supplierQualificationApplicationService.listCurrentSupplierQualifications(status, keyword));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<SupplierQualificationResponse> create(
      @Valid @RequestBody CreateSupplierQualificationRequest request) {
    return ApiResponse.ok(supplierQualificationApplicationService.createCurrentSupplierQualification(request));
  }

  @PostMapping("/{qualificationId}/status")
  public ApiResponse<SupplierQualificationResponse> changeStatus(
      @PathVariable String qualificationId,
      @Valid @RequestBody ChangeSupplierQualificationStatusRequest request) {
    return ApiResponse.ok(supplierQualificationApplicationService.changeQualificationStatus(qualificationId, request));
  }
}
