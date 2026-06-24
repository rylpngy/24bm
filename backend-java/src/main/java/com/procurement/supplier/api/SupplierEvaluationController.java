package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.SupplierEvaluationApplicationService;
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
public class SupplierEvaluationController {
  private final SupplierEvaluationApplicationService evaluationApplicationService;

  public SupplierEvaluationController(
      SupplierEvaluationApplicationService evaluationApplicationService) {
    this.evaluationApplicationService = evaluationApplicationService;
  }

  @GetMapping("/{relationId}/evaluations")
  public ApiResponse<List<SupplierEvaluationResponse>> listEvaluations(
      @PathVariable String relationId) {
    return ApiResponse.ok(evaluationApplicationService.listEvaluations(relationId));
  }

  @PostMapping("/{relationId}/evaluations")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<SupplierEvaluationResponse> createEvaluation(
      @PathVariable String relationId,
      @Valid @RequestBody CreateSupplierEvaluationRequest request) {
    return ApiResponse.ok(evaluationApplicationService.createEvaluation(relationId, request));
  }

  @PostMapping("/{relationId}/tier")
  public ApiResponse<Void> confirmTier(
      @PathVariable String relationId,
      @Valid @RequestBody ConfirmCooperationTierRequest request) {
    evaluationApplicationService.confirmTier(relationId, request);
    return ApiResponse.ok(null);
  }
}
