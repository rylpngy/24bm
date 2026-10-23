package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.SupplierQualificationApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
public class QualificationReviewController {
  private final SupplierQualificationApplicationService service;
  public QualificationReviewController(SupplierQualificationApplicationService service) { this.service = service; }

  @GetMapping("/api/v1/buyer/suppliers/qualification-reviews")
  public ApiResponse<List<QualificationReviewResponse>> buyerReviews() { return ApiResponse.ok(service.buyerReviews()); }

  @GetMapping("/api/v1/supplier/qualifications/reviews")
  public ApiResponse<List<QualificationReviewResponse>> supplierReviews() { return ApiResponse.ok(service.supplierReviews()); }

  @PostMapping("/api/v1/buyer/suppliers/qualification-reviews/{id}/review")
  public ApiResponse<Void> review(@PathVariable long id, @Valid @RequestBody QualificationReviewRequest request) {
    service.review(id, request);
    return ApiResponse.ok(null);
  }
}
