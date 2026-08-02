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
import org.springframework.web.bind.annotation.RequestParam;
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
  public ApiResponse<List<BuyerSupplierResponse>> list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String level,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(buyerSupplierApplicationService.listCurrentTenantSuppliers(
        status,
        level,
        category,
        keyword));
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

  @GetMapping("/{relationId}/qualifications")
  public ApiResponse<List<SupplierQualificationResponse>> listRelationQualifications(
      @PathVariable String relationId) {
    return ApiResponse.ok(buyerSupplierApplicationService.listRelationQualifications(relationId));
  }

  /** 核验下载:采购方在准入审核中查阅供应商证照原件(E-1)。 */
  @GetMapping("/{relationId}/qualifications/{qualificationId}/download")
  public org.springframework.http.ResponseEntity<org.springframework.core.io.Resource> downloadQualification(
      @PathVariable String relationId, @PathVariable String qualificationId) {
    return SupplierQualificationController.streamed(
        buyerSupplierApplicationService.loadRelationQualificationObject(relationId, qualificationId),
        qualificationId);
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

  @PostMapping("/{relationId}/profile")
  public ApiResponse<BuyerSupplierResponse> changeProfile(
      @PathVariable String relationId,
      @Valid @RequestBody ChangeBuyerSupplierProfileRequest request) {
    return ApiResponse.ok(buyerSupplierApplicationService.changeRelationProfile(relationId, request));
  }

  @PostMapping("/{relationId}/performance")
  public ApiResponse<BuyerSupplierResponse> changePerformance(
      @PathVariable String relationId,
      @Valid @RequestBody ChangeBuyerSupplierPerformanceRequest request) {
    return ApiResponse.ok(buyerSupplierApplicationService.changeRelationPerformance(relationId, request));
  }
}
