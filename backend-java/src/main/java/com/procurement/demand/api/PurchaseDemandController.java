package com.procurement.demand.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.demand.application.PurchaseDemandApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/demands")
public class PurchaseDemandController {
  private final PurchaseDemandApplicationService purchaseDemandApplicationService;

  public PurchaseDemandController(PurchaseDemandApplicationService purchaseDemandApplicationService) {
    this.purchaseDemandApplicationService = purchaseDemandApplicationService;
  }

  @GetMapping
  public ApiResponse<List<PurchaseDemandResponse>> list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String departmentId,
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(purchaseDemandApplicationService.listCurrentTenantDemands(
        status,
        departmentId,
        keyword));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<PurchaseDemandResponse> create(@Valid @RequestBody CreatePurchaseDemandRequest request) {
    return ApiResponse.ok(purchaseDemandApplicationService.create(request));
  }

  @PutMapping("/{demandId}")
  public ApiResponse<PurchaseDemandResponse> update(
      @PathVariable String demandId,
      @Valid @RequestBody UpdatePurchaseDemandRequest request) {
    return ApiResponse.ok(purchaseDemandApplicationService.update(demandId, request));
  }

  @PostMapping("/{demandId}/submit")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<ApprovalTaskResponse> submit(@PathVariable String demandId) {
    return ApiResponse.ok(purchaseDemandApplicationService.submit(demandId));
  }

  @PostMapping("/{demandId}/approval")
  public ApiResponse<ApprovalTaskResponse> review(
      @PathVariable String demandId,
      @Valid @RequestBody ReviewPurchaseDemandRequest request) {
    return ApiResponse.ok(purchaseDemandApplicationService.review(demandId, request));
  }
}
