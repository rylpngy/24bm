package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.demand.api.ApprovalTaskResponse;
import com.procurement.supplier.application.BuyerSupplierApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/suppliers")
public class BuyerSupplierController {
  private final BuyerSupplierApplicationService buyerSupplierApplicationService;

  public BuyerSupplierController(BuyerSupplierApplicationService buyerSupplierApplicationService) {
    this.buyerSupplierApplicationService = buyerSupplierApplicationService;
  }

  @GetMapping
  public ApiResponse<List<BuyerSupplierResponse>> list() {
    return ApiResponse.ok(buyerSupplierApplicationService.listCurrentTenantSuppliers());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<BuyerSupplierResponse> create(@Valid @RequestBody CreateBuyerSupplierRequest request) {
    return ApiResponse.ok(buyerSupplierApplicationService.createSupplierRelation(request));
  }

  @PostMapping("/{relationId}/submit")
  public ApiResponse<ApprovalTaskResponse> submitAdmission(@PathVariable String relationId) {
    return ApiResponse.ok(buyerSupplierApplicationService.submitAdmission(relationId));
  }

  @PostMapping("/{relationId}/approval")
  public ApiResponse<ApprovalTaskResponse> reviewAdmission(
      @PathVariable String relationId,
      @Valid @RequestBody ReviewBuyerSupplierAdmissionRequest request) {
    return ApiResponse.ok(buyerSupplierApplicationService.reviewAdmission(relationId, request));
  }

  @PostMapping("/{relationId}/status")
  public ApiResponse<BuyerSupplierResponse> changeStatus(
      @PathVariable String relationId,
      @Valid @RequestBody ChangeBuyerSupplierStatusRequest request) {
    return ApiResponse.ok(buyerSupplierApplicationService.changeRelationStatus(relationId, request));
  }
}
